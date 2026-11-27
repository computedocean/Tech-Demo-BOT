import { evaluatePolicy } from "./policy.ts";
import { matchPreset } from "./presets.ts";
import { applyWrite, initialSandbox } from "./sandbox.ts";
import type { AuditEntry, DecisionOutcome, DeskState } from "./types.ts";

export function isoNow(): string {
  return new Date().toISOString();
}

export function resetDesk(): DeskState {
  return {
    sandbox: initialSandbox(),
    task: "",
    proposal: null,
    policy: null,
    decision: null,
    blockedReason: null,
    audit: [],
    lastApprovedDiff: null,
    lastApprovedPath: null,
  };
}

export function setTask(state: DeskState, task: string): DeskState {
  return {
    ...state,
    task,
    proposal: null,
    policy: null,
    decision: null,
    blockedReason: null,
  };
}

export function propose(state: DeskState): DeskState {
  const task = state.task.trim();
  if (task.length === 0) return state;
  const preset = matchPreset(task);
  const proposal = preset.build(state.sandbox);
  const policy = evaluatePolicy(proposal);
  return {
    ...state,
    proposal,
    policy,
    decision: null,
    blockedReason: null,
  };
}

export function canApprove(state: DeskState): boolean {
  return Boolean(
    state.proposal &&
      state.policy?.approvable &&
      state.policy.decision === "needs_approval" &&
      state.decision === null,
  );
}

export function canDeny(state: DeskState): boolean {
  return Boolean(state.proposal && state.policy && state.decision === null);
}

function auditEntry(state: DeskState, outcome: DecisionOutcome, timestamp: string): AuditEntry {
  const proposal = state.proposal;
  const policy = state.policy;
  if (!proposal || !policy) {
    throw new Error("An audit row needs a proposal and a policy result.");
  }
  return {
    id: `${timestamp}-${outcome}-${state.audit.length}`,
    timestamp,
    task: state.task,
    proposedAction: {
      tool: proposal.tool,
      target: proposal.target,
      summary: proposal.summary,
    },
    policyResult: policy,
    outcome,
  };
}

export function approve(state: DeskState, now: () => string = isoNow): DeskState {
  if (!state.proposal || !state.policy || state.decision !== null) return state;
  if (!canApprove(state)) {
    return {
      ...state,
      blockedReason: "Approve is impossible: the policy did not allow this action.",
    };
  }

  let sandbox = state.sandbox;
  if (state.proposal.write) {
    try {
      sandbox = applyWrite(state.sandbox, state.proposal.write);
    } catch {
      return {
        ...state,
        blockedReason: "Approve is impossible: the write is outside the sandbox.",
      };
    }
  }

  return {
    ...state,
    sandbox,
    decision: "approved",
    blockedReason: null,
    lastApprovedDiff: state.proposal.diff ?? state.lastApprovedDiff,
    lastApprovedPath: state.proposal.write?.path ?? state.lastApprovedPath,
    audit: [...state.audit, auditEntry(state, "approved", now())],
  };
}

export function deny(state: DeskState, now: () => string = isoNow): DeskState {
  if (!canDeny(state)) return state;
  return {
    ...state,
    decision: "denied",
    blockedReason: null,
    audit: [...state.audit, auditEntry(state, "denied", now())],
  };
}
