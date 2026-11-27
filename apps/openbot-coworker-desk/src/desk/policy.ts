import { isInsideSandbox, PATH_SCOPE } from "./sandbox.ts";
import { ALLOWED_TOOLS, type PolicyResult, type ProposedAction } from "./types.ts";

const ALLOWED = new Set<string>(ALLOWED_TOOLS);

export function evaluatePolicy(action: ProposedAction): PolicyResult {
  const base = {
    allowedTools: ALLOWED_TOOLS,
    pathScope: PATH_SCOPE,
  };

  if (!ALLOWED.has(action.tool)) {
    return {
      ...base,
      decision: "denied",
      approvable: false,
      reason: `Tool ${action.tool} is not on the allow list. The check fails closed, so Approve stays disabled and nothing runs.`,
    };
  }

  if (!isInsideSandbox(action.target)) {
    return {
      ...base,
      decision: "denied",
      approvable: false,
      reason: `Target ${action.target} is outside the sandbox path scope. Approve stays disabled, and the sandbox is left untouched.`,
    };
  }

  if (action.tool === "files.write") {
    return {
      ...base,
      decision: "needs_approval",
      approvable: true,
      reason:
        "files.write is on the allow list and the target is inside the sandbox. A person still has to approve it. The file changes only after Approve, and the decision is recorded first.",
    };
  }

  return {
    ...base,
    decision: "needs_approval",
    approvable: true,
    reason: `${action.tool} stays inside the sandbox. This lab still waits for an explicit decision before the result is kept. Nothing is sent over the network.`,
  };
}
