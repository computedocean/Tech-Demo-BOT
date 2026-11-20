export const ALLOWED_TOOLS = [
  "files.write",
  "files.read",
  "files.list",
  "browser.preview",
] as const;

export type AllowedTool = (typeof ALLOWED_TOOLS)[number];

export type ToolName = AllowedTool | "shell.exec";

export type PolicyDecision = "needs_approval" | "denied";

export type DecisionOutcome = "approved" | "denied";

export interface FileWrite {
  path: string;
  content: string;
}

export interface ProposedAction {
  presetId: string;
  presetLabel: string;
  tool: ToolName;
  target: string;
  summary: string;
  diff: string | null;
  transcript: string | null;
  write: FileWrite | null;
}

export interface PolicyResult {
  decision: PolicyDecision;
  approvable: boolean;
  allowedTools: readonly AllowedTool[];
  pathScope: string;
  reason: string;
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  task: string;
  proposedAction: {
    tool: ToolName;
    target: string;
    summary: string;
  };
  policyResult: PolicyResult;
  outcome: DecisionOutcome;
}

export interface Sandbox {
  files: Record<string, string>;
}

export interface DeskState {
  sandbox: Sandbox;
  task: string;
  proposal: ProposedAction | null;
  policy: PolicyResult | null;
  decision: DecisionOutcome | null;
  blockedReason: string | null;
  audit: AuditEntry[];
  lastApprovedDiff: string | null;
  lastApprovedPath: string | null;
}
