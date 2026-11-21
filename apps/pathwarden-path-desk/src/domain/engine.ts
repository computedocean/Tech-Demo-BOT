import { SEVERITY_RANK, severityBand } from "./severity.ts";
import type {
  Analysis,
  AttackPath,
  EdgeKind,
  Finding,
  Fix,
  Graph,
  GraphEdge,
  GraphNode,
} from "./types.ts";

const MAX_HOPS = 6;

/** Relationship kinds that mean direct control when the target is Tier Zero. */
const DIRECT_CONTROL_KINDS = new Set<EdgeKind>([
  "DCSync",
  "GenericAll",
  "GenericWrite",
  "AdminTo",
  "AddMember",
  "MemberOf",
]);

export function isAccount(node: GraphNode): boolean {
  return node.kind === "user" || node.kind === "entra-user";
}

export function enumeratePaths(
  graph: Graph,
  removedEdgeIds: ReadonlySet<string> = new Set(),
): AttackPath[] {
  const tierZero = new Set(
    graph.nodes.filter((node) => node.tierZero).map((node) => node.id),
  );
  const adjacency = new Map<string, GraphEdge[]>();
  for (const edge of graph.edges) {
    if (removedEdgeIds.has(edge.id)) continue;
    const list = adjacency.get(edge.source);
    if (list) list.push(edge);
    else adjacency.set(edge.source, [edge]);
  }

  const paths: AttackPath[] = [];
  const accounts = graph.nodes.filter((node) => isAccount(node) && !node.tierZero);

  for (const account of accounts) {
    const nodeIds = [account.id];
    const edgeIds: string[] = [];
    const seen = new Set<string>([account.id]);

    const walk = () => {
      const current = nodeIds[nodeIds.length - 1];
      if (nodeIds.length > 1 && current && tierZero.has(current)) {
        paths.push({
          id: `${account.id}|${edgeIds.join(">")}`,
          startId: account.id,
          endId: current,
          nodeIds: [...nodeIds],
          edgeIds: [...edgeIds],
        });
        return;
      }
      if (edgeIds.length >= MAX_HOPS || !current) return;
      for (const edge of adjacency.get(current) ?? []) {
        if (seen.has(edge.target)) continue;
        seen.add(edge.target);
        nodeIds.push(edge.target);
        edgeIds.push(edge.id);
        walk();
        edgeIds.pop();
        nodeIds.pop();
        seen.delete(edge.target);
      }
    };

    walk();
  }

  return paths;
}

function nodeMap(graph: Graph): Map<string, GraphNode> {
  return new Map(graph.nodes.map((node) => [node.id, node]));
}

function edgeMap(graph: Graph): Map<string, GraphEdge> {
  return new Map(graph.edges.map((edge) => [edge.id, edge]));
}

function isDirectControl(edge: GraphEdge, target: GraphNode | undefined): boolean {
  return Boolean(target?.tierZero && DIRECT_CONTROL_KINDS.has(edge.kind));
}

function findingCopy(
  edge: GraphEdge,
  source: GraphNode,
  target: GraphNode,
  directControl: boolean,
): { title: string; detail: string } {
  const relationship = `${source.name} — ${edge.kind} — ${target.name}`;
  if (edge.kind === "HasSession") {
    return {
      title: `${target.name} has a session on ${source.name}`,
      detail: `${relationship}. Accounts that reach this computer also reach a Tier Zero principal in the simulation.`,
    };
  }
  if (edge.kind === "DCSync") {
    return {
      title: `${source.name} has DCSync on ${target.name}`,
      detail: `${relationship}. Direct control of a Tier Zero object is ranked at least High.`,
    };
  }
  if (directControl) {
    return {
      title: `${source.name} has ${edge.kind} on Tier Zero ${target.name}`,
      detail: `${relationship}. Direct control of a Tier Zero object is ranked at least High.`,
    };
  }
  return {
    title: `${source.name} reaches Tier Zero through ${edge.kind} on ${target.name}`,
    detail: `${relationship}. Exposure is the share of non-Tier Zero accounts with a path through this relationship.`,
  };
}

export function rankFindings(
  graph: Graph,
  paths: readonly AttackPath[],
  nonTierZeroAccounts: number,
): Finding[] {
  const nodes = nodeMap(graph);
  const edges = edgeMap(graph);
  const grouped = new Map<string, AttackPath[]>();

  for (const path of paths) {
    const entryEdgeId = path.edgeIds[path.edgeIds.length - 1];
    if (!entryEdgeId) continue;
    const list = grouped.get(entryEdgeId);
    if (list) list.push(path);
    else grouped.set(entryEdgeId, [path]);
  }

  const findings: Finding[] = [];
  for (const [entryEdgeId, group] of grouped) {
    const edge = edges.get(entryEdgeId);
    const source = edge ? nodes.get(edge.source) : undefined;
    const target = edge ? nodes.get(edge.target) : undefined;
    if (!edge || !source || !target) continue;

    const accountIds = [...new Set(group.map((path) => path.startId))].sort();
    const exposure = accountIds.length;
    const share = nonTierZeroAccounts === 0 ? 0 : exposure / nonTierZeroAccounts;
    const directControl = isDirectControl(edge, target);
    const copy = findingCopy(edge, source, target, directControl);
    const representative = [...group].sort((a, b) => {
      if (a.edgeIds.length !== b.edgeIds.length) return a.edgeIds.length - b.edgeIds.length;
      const aName = nodes.get(a.startId)?.name ?? a.startId;
      const bName = nodes.get(b.startId)?.name ?? b.startId;
      if (aName !== bName) return aName.localeCompare(bName);
      return a.id.localeCompare(b.id);
    })[0];
    if (!representative) continue;

    findings.push({
      id: `finding:${entryEdgeId}`,
      title: copy.title,
      detail: copy.detail,
      entryEdgeId,
      directControl,
      exposure,
      share,
      severity: severityBand(share, directControl),
      accountIds,
      path: representative,
    });
  }

  findings.sort((a, b) => {
    const bySeverity = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
    if (bySeverity !== 0) return bySeverity;
    if (b.exposure !== a.exposure) return b.exposure - a.exposure;
    return a.id.localeCompare(b.id);
  });
  return findings;
}

function covers(paths: readonly string[][], chosen: ReadonlySet<string>): boolean {
  return paths.every((path) => path.some((edgeId) => chosen.has(edgeId)));
}

function bitCount(value: number): number {
  let count = 0;
  let rest = value;
  while (rest) {
    count += rest & 1;
    rest >>>= 1;
  }
  return count;
}

/** Smallest set of removable edges that intersects every enumerated path. */
export function minimumEdgeCut(paths: readonly AttackPath[], removable: ReadonlySet<string>): string[] {
  const candidates = [
    ...new Set(
      paths.flatMap((path) => path.edgeIds).filter((edgeId) => removable.has(edgeId)),
    ),
  ].sort();
  const asEdges = paths.map((path) => path.edgeIds);
  if (asEdges.some((path) => !path.some((edgeId) => removable.has(edgeId)))) {
    return [];
  }
  if (candidates.length === 0) return [];

  if (candidates.length <= 18) {
    const total = 1 << candidates.length;
    let best: string[] | null = null;
    let bestSize = Infinity;
    for (let mask = 1; mask < total; mask++) {
      const size = bitCount(mask);
      if (size > bestSize) continue;
      const subset: string[] = [];
      for (let index = 0; index < candidates.length; index++) {
        if (mask & (1 << index)) {
          const edgeId = candidates[index];
          if (edgeId) subset.push(edgeId);
        }
      }
      if (!covers(asEdges, new Set(subset))) continue;
      const key = subset.join("\0");
      if (size < bestSize || (best && key < best.join("\0"))) {
        best = subset;
        bestSize = size;
      }
    }
    return best ?? [];
  }

  const picked: string[] = [];
  let remaining = asEdges.map((path) => [...path]);
  while (remaining.length > 0) {
    let bestEdge = "";
    let bestHit = 0;
    for (const edgeId of candidates) {
      if (picked.includes(edgeId)) continue;
      const hit = remaining.filter((path) => path.includes(edgeId)).length;
      if (hit > bestHit || (hit === bestHit && hit > 0 && edgeId < bestEdge)) {
        bestHit = hit;
        bestEdge = edgeId;
      }
    }
    if (bestHit === 0 || !bestEdge) break;
    picked.push(bestEdge);
    remaining = remaining.filter((path) => !path.includes(bestEdge));
  }
  return picked.filter((_, index) => {
    const others = new Set(picked.filter((__, other) => other !== index));
    return !covers(asEdges, others);
  });
}

function fixCopy(
  edge: GraphEdge,
  source: GraphNode,
  target: GraphNode,
  pathsClosed: number,
  accountsTouched: number,
): { title: string; detail: string } {
  return {
    title: `Remove ${edge.kind} from ${source.name} to ${target.name}`,
    detail: `Drop this ${edge.kind} relationship in the simulation. It closes ${pathsClosed} paths used by ${accountsTouched} non-Tier Zero accounts. Nothing outside this desk is changed.`,
  };
}

export function buildFixes(graph: Graph, paths: readonly AttackPath[], edgeIds: readonly string[]): Fix[] {
  const nodes = nodeMap(graph);
  const edges = edgeMap(graph);
  const fixes: Fix[] = [];
  for (const edgeId of edgeIds) {
    const edge = edges.get(edgeId);
    const source = edge ? nodes.get(edge.source) : undefined;
    const target = edge ? nodes.get(edge.target) : undefined;
    if (!edge || !source || !target) continue;
    const closed = paths.filter((path) => path.edgeIds.includes(edgeId));
    const accountsTouched = new Set(closed.map((path) => path.startId)).size;
    const copy = fixCopy(edge, source, target, closed.length, accountsTouched);
    fixes.push({
      edgeId,
      title: copy.title,
      detail: copy.detail,
      pathsClosed: closed.length,
      accountsTouched,
    });
  }
  fixes.sort((a, b) => {
    if (b.pathsClosed !== a.pathsClosed) return b.pathsClosed - a.pathsClosed;
    if (b.accountsTouched !== a.accountsTouched) return b.accountsTouched - a.accountsTouched;
    return a.edgeId.localeCompare(b.edgeId);
  });
  return fixes;
}

export function analyze(graph: Graph, removedEdgeIds: Iterable<string> = []): Analysis {
  const removed = new Set(removedEdgeIds);
  const nonTierZeroAccounts = graph.nodes.filter((node) => isAccount(node) && !node.tierZero).length;
  const paths = enumeratePaths(graph, removed);
  const findings = rankFindings(graph, paths, nonTierZeroAccounts);
  const removable = new Set(graph.edges.filter((edge) => edge.removable).map((edge) => edge.id));
  const fixes = buildFixes(graph, paths, minimumEdgeCut(paths, removable));
  const accountsWithPath = new Set(paths.map((path) => path.startId)).size;
  return { paths, findings, fixes, accountsWithPath, nonTierZeroAccounts };
}
