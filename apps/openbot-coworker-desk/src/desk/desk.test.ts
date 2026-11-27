import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { demoBeats, playDemo } from "./demo.ts";
import { approve, canApprove, canDeny, deny, propose, resetDesk, setTask } from "./loop.ts";
import { matchPreset } from "./presets.ts";
import { applyWrite, initialSandbox } from "./sandbox.ts";

const FIXED = () => "2026-11-13T08:00:01.000Z";

function sourceFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      found.push(...sourceFiles(full));
      continue;
    }
    if (full.endsWith(".test.ts")) continue;
    found.push(full);
  }
  return found;
}

describe("decide then record", () => {
  test("a proposal and a policy result exist before any mutation", () => {
    const initial = initialSandbox();
    const state = propose(setTask(resetDesk(), "Add a title to notes.md."));

    expect(state.proposal).not.toBeNull();
    expect(state.proposal?.tool).toBe("files.write");
    expect(state.proposal?.target).toBe("notes.md");
    expect(state.proposal?.diff).toContain("+# Notes");
    expect(state.policy).not.toBeNull();
    expect(state.policy?.decision).toBe("needs_approval");
    expect(state.policy?.approvable).toBe(true);
    expect(state.policy?.allowedTools).toContain("files.write");
    expect(state.sandbox).toEqual(initial);
    expect(state.audit).toEqual([]);
    expect(canApprove(state)).toBe(true);
    expect(canDeny(state)).toBe(true);
    expect(canApprove(resetDesk())).toBe(false);
    expect(canDeny(resetDesk())).toBe(false);
  });

  test("maps the sample tasks onto presets without a model", () => {
    expect(matchPreset("Add a title to notes.md").id).toBe("add-title");
    expect(matchPreset("Add a title to notes.md.").id).toBe("add-title");
    expect(matchPreset("List the files in the sandbox").id).toBe("list-files");
    expect(matchPreset("Draft a changelog line").id).toBe("changelog");
    expect(matchPreset("Preview the sandbox readme").id).toBe("readme-preview");
  });

  test("Approve writes only the sandbox file and logs approved", () => {
    const initial = initialSandbox();
    const proposed = propose(setTask(resetDesk(), "Add a title to notes.md."));
    const approved = approve(proposed, FIXED);

    expect(approved.sandbox.files["notes.md"]?.startsWith("# Notes\n")).toBe(true);
    expect(approved.sandbox.files["CHANGELOG.md"]).toBe(initial.files["CHANGELOG.md"]);
    expect(approved.sandbox.files["readme.md"]).toBe(initial.files["readme.md"]);
    expect(Object.keys(approved.sandbox.files).sort()).toEqual([
      "CHANGELOG.md",
      "notes.md",
      "readme.md",
    ]);
    expect(approved.audit).toHaveLength(1);
    expect(approved.audit[0]).toMatchObject({
      timestamp: "2026-11-13T08:00:01.000Z",
      task: "Add a title to notes.md.",
      outcome: "approved",
      proposedAction: {
        tool: "files.write",
        target: "notes.md",
      },
      policyResult: { decision: "needs_approval", approvable: true },
    });
    expect(approved.lastApprovedDiff).toContain("+# Notes");
  });

  test("Deny mutates nothing and logs denied", () => {
    const proposed = propose(setTask(resetDesk(), "Draft a changelog line"));
    const before = structuredClone(proposed.sandbox);
    const denied = deny(proposed, FIXED);

    expect(denied.sandbox).toEqual(before);
    expect(denied.audit).toHaveLength(1);
    expect(denied.audit[0]?.outcome).toBe("denied");
    expect(denied.audit[0]?.task).toBe("Draft a changelog line");
    expect(denied.audit[0]?.proposedAction.target).toBe("CHANGELOG.md");
    expect(denied.audit[0]?.policyResult.decision).toBe("needs_approval");
    expect(canApprove(denied)).toBe(false);
  });

  test("a path outside the sandbox cannot be approved", () => {
    const proposed = propose(
      setTask(resetDesk(), "Copy notes.md outside the sandbox to ../outside/notes.md"),
    );
    expect(proposed.proposal?.target).toBe("../outside/notes.md");
    expect(proposed.policy?.decision).toBe("denied");
    expect(proposed.policy?.approvable).toBe(false);
    expect(canApprove(proposed)).toBe(false);
    expect(canDeny(proposed)).toBe(true);

    const before = structuredClone(proposed.sandbox);
    const refused = approve(proposed, FIXED);
    expect(refused.sandbox).toEqual(before);
    expect(refused.audit.filter((entry) => entry.outcome === "approved")).toEqual([]);
    expect(refused.blockedReason).toContain("impossible");
    expect(() =>
      applyWrite(initialSandbox(), {
        path: "../outside/notes.md",
        content: "nope",
      }),
    ).toThrow(/outside the sandbox/);
  });

  test("a tool outside the allow list cannot be approved", () => {
    const proposed = propose(setTask(resetDesk(), "Run a shell command"));
    expect(proposed.proposal?.tool).toBe("shell.exec");
    expect(proposed.policy?.approvable).toBe(false);
    const before = structuredClone(proposed.sandbox);
    const refused = approve(proposed, FIXED);
    expect(refused.sandbox).toEqual(before);
    expect(refused.audit).toEqual([]);
  });

  test("the scripted run approves one sandbox diff and then denies the outside path", () => {
    const clock = () => "2026-11-13T08:00:00.000Z";
    let state = resetDesk();
    const beats = [
      "task",
      "propose",
      "policy",
      "approve",
      "approved-visible",
      "outside-task",
      "outside-propose",
      "outside-hold",
      "deny",
    ];
    const script = demoBeats(() => "2026-11-13T08:05:00.000Z");
    expect(script.map((beat) => beat.id)).toEqual(beats);

    for (const beat of script) {
      const before = structuredClone(state.sandbox);
      state = beat.apply(state);
      if (beat.id === "propose" || beat.id === "policy") {
        expect(state.sandbox).toEqual(before);
        expect(state.proposal?.tool).toBe("files.write");
        expect(state.policy?.approvable).toBe(true);
        expect(state.audit).toEqual([]);
      }
      if (beat.id === "outside-propose" || beat.id === "outside-hold") {
        expect(state.policy?.approvable).toBe(false);
        expect(canApprove(state)).toBe(false);
        expect(state.sandbox.files["notes.md"]).toContain("# Notes");
        expect(state.sandbox.files["../outside/notes.md"]).toBeUndefined();
      }
    }

    expect(state.audit.map((entry) => entry.outcome)).toEqual(["approved", "denied"]);
    expect(state.sandbox.files["notes.md"]?.startsWith("# Notes\n")).toBe(true);
    expect(Object.keys(state.sandbox.files)).not.toContain("../outside/notes.md");
    expect(playDemo(clock).audit.map((entry) => entry.outcome)).toEqual(["approved", "denied"]);
  });

  test("no keys or tokens are required or leaked", () => {
    const patterns = [
      /process\.env/,
      /import\.meta\.env/,
      /\bfetch\s*\(/,
      /\bWebSocket\b/,
      /COPILOTKIT_LICENSE_TOKEN/,
      /sk-[A-Za-z0-9]{8,}/,
      /AKIA[0-9A-Z]{16}/,
      /Bearer\s+[A-Za-z0-9_\-.]{8,}/,
      /VITE_[A-Z0-9_]+/,
      /api[_-]?key\s*[:=]\s*["'][^"']+["']/i,
      /licenseToken/i,
    ];
    const root = path.resolve(import.meta.dir, "../..");
    const files = sourceFiles(path.join(root, "src"));
    const offenders: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      for (const pattern of patterns) {
        if (pattern.test(text)) offenders.push(`${path.relative(root, file)} matches ${pattern}`);
      }
    }
    expect(offenders).toEqual([]);

    const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const names = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
    expect(names.some((name) => /copilotkit|openbot|intelligence/i.test(name))).toBe(false);

    const originalFetch = globalThis.fetch;
    let called = false;
    globalThis.fetch = (() => {
      called = true;
      throw new Error("network is not used");
    }) as typeof fetch;
    try {
      const finished = playDemo(FIXED);
      const serialized = JSON.stringify(finished);
      expect(called).toBe(false);
      expect(serialized).not.toMatch(/sk-[A-Za-z0-9]{8,}/);
      expect(serialized).not.toMatch(/COPILOTKIT/);
      expect(serialized).not.toMatch(/licenseToken/i);
      expect(serialized).not.toMatch(/Bearer /);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
