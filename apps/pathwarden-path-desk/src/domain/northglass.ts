import type { EdgeKind, Graph, GraphEdge, GraphNode, NodeKind } from "./types.ts";

/**
 * Invented company. Not a real directory and not Pathwarden's sample corpus.
 * All Staff membership is not a recommended cut: it stands in for a
 * directory-wide class of membership.
 */

export interface Snapshot {
  id: string;
  label: string;
  takenAt: string;
  disabledEdgeIds: string[];
}

const PEOPLE: Array<[string, string]> = [
  ["u-ben", "Ben Cho"],
  ["u-cara", "Cara Singh"],
  ["u-diego", "Diego Alvarez"],
  ["u-elena", "Elena Petrova"],
  ["u-farah", "Farah Ndiaye"],
  ["u-gio", "Gio Rossi"],
  ["u-hana", "Hana Sato"],
  ["u-ivan", "Ivan Petrov"],
  ["u-jade", "Jade Williams"],
  ["u-leila", "Leila Hassan"],
  ["u-marco", "Marco Berg"],
  ["u-nia", "Nia Okeke"],
  ["u-omar", "Omar Farouk"],
  ["u-priya", "Priya Shah"],
  ["u-quinn", "Quinn Bauer"],
  ["u-rafa", "Rafa Silva"],
  ["u-sofia", "Sofia Novak"],
  ["u-theo", "Theo Martin"],
  ["u-uma", "Uma Iyer"],
  ["u-wes", "Wes Clarke"],
];

const DOMAIN = "NORTHGLASS.LAB";
const TENANT = "northglass.example";

function node(
  id: string,
  name: string,
  kind: NodeKind,
  tierZero: boolean,
  domain: string,
  x: number,
  y: number,
): GraphNode {
  return { id, name, kind, tierZero, domain, x, y };
}

function edge(
  id: string,
  source: string,
  target: string,
  kind: EdgeKind,
  removable: boolean,
): GraphEdge {
  return { id, source, target, kind, removable };
}

function buildGraph(): Graph {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  PEOPLE.forEach(([id, name], index) => {
    nodes.push(node(id, name, "user", false, DOMAIN, 0, 24 + index * 58));
  });

  nodes.push(
    node("u-ada", "Ada Okonkwo", "user", true, DOMAIN, 860, 24),
    node("eu-ada", "Ada Okonkwo", "entra-user", true, TENANT, 860, 150),
    node("eu-jade", "Jade Williams", "entra-user", false, TENANT, 560, 520),
    node("dom", "NORTHGLASS.LAB", "domain", true, DOMAIN, 860, 280),
    node("dc", "NG-DC01", "computer", true, DOMAIN, 860, 400),
    node("g-da", "Domain Admins", "group", true, DOMAIN, 860, 520),
    node("g-ea", "Enterprise Admins", "group", true, DOMAIN, 860, 640),
    node("eg-ga", "Global Administrators", "entra-group", true, TENANT, 860, 760),
    node("g-staff", "All Staff", "group", false, DOMAIN, 280, 24),
    node("g-it", "IT Operators", "group", false, DOMAIN, 280, 160),
    node("g-ops", "Workstation Ops", "group", false, DOMAIN, 280, 300),
    node("g-remote", "Remote Staff", "group", false, DOMAIN, 280, 440),
    node("g-hd", "Helpdesk", "group", false, DOMAIN, 280, 620),
    node("g-fin", "Finance Liaisons", "group", false, DOMAIN, 280, 780),
    node("eg-app", "Cloud App Admins", "entra-group", false, TENANT, 560, 680),
    node("c-file", "NG-FILE01", "computer", false, DOMAIN, 560, 24),
    node("c-fin", "NG-FIN01", "computer", false, DOMAIN, 560, 300),
    node("c-jump", "NG-JUMP01", "computer", false, DOMAIN, 560, 620),
    node("c-legacy", "NG-LEGACY01", "computer", false, DOMAIN, 560, 780),
  );

  const member = (userId: string, groupId: string) => {
    edges.push(edge(`mem-${userId}-${groupId}`, userId, groupId, "MemberOf", false));
  };

  PEOPLE.forEach(([id], index) => {
    member(id, "g-staff");
    if (index <= 3) member(id, "g-it");
    if (index <= 8) member(id, "g-ops");
    if (index >= 3) member(id, "g-remote");
    if (index >= 16) member(id, "g-hd");
    if (index >= 18) member(id, "g-fin");
  });

  edges.push(
    edge("mem-u-ada-g-da", "u-ada", "g-da", "MemberOf", false),
    edge("mem-g-da-g-ea", "g-da", "g-ea", "MemberOf", false),
    edge("sync-ada", "u-ada", "eu-ada", "SyncedTo", false),
    edge("mem-eu-ada-eg-ga", "eu-ada", "eg-ga", "MemberOf", false),
    edge("sync-jade", "u-jade", "eu-jade", "SyncedTo", false),
    edge("mem-eu-jade-eg-app", "eu-jade", "eg-app", "MemberOf", false),
    edge("fix-staff-file", "g-staff", "c-file", "AdminTo", true),
    edge("session-file", "c-file", "u-ada", "HasSession", false),
    edge("ace-remote-dc", "g-remote", "dc", "GenericAll", true),
    edge("ace-it-dcsync", "g-it", "dom", "DCSync", true),
    edge("fix-ops-fin", "g-ops", "c-fin", "AdminTo", true),
    edge("session-fin", "c-fin", "u-ada", "HasSession", false),
    edge("fix-hd-jump", "g-hd", "c-jump", "GenericAll", true),
    edge("session-jump", "c-jump", "u-ada", "HasSession", false),
    edge("fix-fin-legacy", "g-fin", "c-legacy", "GenericAll", true),
    edge("session-legacy", "c-legacy", "u-ada", "HasSession", false),
    edge("ace-entra-ga", "eg-app", "eg-ga", "GenericAll", true),
  );

  return {
    id: "northglass",
    name: "Northglass Analytical",
    sourceNote:
      "Invented synthetic directory for Northglass Analytical. Not a real domain and not copied from a collector.",
    nodes,
    edges,
  };
}

export const BASE_GRAPH: Graph = buildGraph();

export const SNAPSHOTS: Snapshot[] = [
  {
    id: "2026-09-07",
    label: "September baseline",
    takenAt: "2026-09-07",
    disabledEdgeIds: ["ace-remote-dc", "fix-hd-jump"],
  },
  {
    id: "2026-10-05",
    label: "October collection",
    takenAt: "2026-10-05",
    disabledEdgeIds: ["ace-it-dcsync", "fix-fin-legacy", "fix-hd-jump"],
  },
  {
    id: "2026-11-02",
    label: "November week 1",
    takenAt: "2026-11-02",
    disabledEdgeIds: ["ace-it-dcsync", "fix-ops-fin", "fix-hd-jump"],
  },
  {
    id: "2026-11-16",
    label: "November week 3",
    takenAt: "2026-11-16",
    disabledEdgeIds: ["fix-ops-fin"],
  },
];

export const CURRENT_SNAPSHOT_ID = "2026-11-16";

export function graphForSnapshot(snapshotId: string): Graph {
  const snapshot = SNAPSHOTS.find((item) => item.id === snapshotId) ?? SNAPSHOTS[SNAPSHOTS.length - 1];
  if (!snapshot) return BASE_GRAPH;
  const disabled = new Set(snapshot.disabledEdgeIds);
  return {
    ...BASE_GRAPH,
    id: `northglass:${snapshot.id}`,
    name: `${BASE_GRAPH.name} · ${snapshot.label}`,
    edges: BASE_GRAPH.edges.filter((item) => !disabled.has(item.id)),
  };
}
