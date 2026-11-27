export type NodeKind =
  | "user"
  | "group"
  | "computer"
  | "domain"
  | "entra-user"
  | "entra-group"
  | "tenant";

export type EdgeKind =
  | "MemberOf"
  | "AdminTo"
  | "HasSession"
  | "GenericAll"
  | "GenericWrite"
  | "DCSync"
  | "AddMember"
  | "SyncedTo";

export type Severity = "critical" | "high" | "medium" | "low";

export type FindingBadge = "New" | "Open" | "Fixed" | "Regressed";

export interface GraphNode {
  id: string;
  name: string;
  kind: NodeKind;
  tierZero: boolean;
  domain: string;
  x: number;
  y: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  kind: EdgeKind;
  /** When false, the desk will not recommend removing this relationship. */
  removable: boolean;
}

export interface Graph {
  id: string;
  name: string;
  sourceNote: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface AttackPath {
  id: string;
  startId: string;
  endId: string;
  nodeIds: string[];
  edgeIds: string[];
}

export interface Finding {
  id: string;
  title: string;
  detail: string;
  entryEdgeId: string;
  directControl: boolean;
  exposure: number;
  share: number;
  severity: Severity;
  accountIds: string[];
  path: AttackPath;
}

export interface Fix {
  edgeId: string;
  title: string;
  detail: string;
  pathsClosed: number;
  accountsTouched: number;
}

export interface Analysis {
  paths: AttackPath[];
  findings: Finding[];
  fixes: Fix[];
  accountsWithPath: number;
  nonTierZeroAccounts: number;
}

export interface DiffItem {
  findingId: string;
  title: string;
  badge: FindingBadge;
  severity: Severity;
}

export interface RunSummary {
  snapshotId: string;
  findings: Array<{
    id: string;
    title: string;
    severity: Severity;
  }>;
}
