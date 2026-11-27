import { approve, deny, propose, resetDesk, setTask } from "./loop.ts";
import type { DeskState } from "./types.ts";

export interface ScriptBeat {
  id: string;
  caption: string;
  apply: (state: DeskState) => DeskState;
}

export function incrementingClock(start = "2026-11-13T08:00:00.000Z"): () => string {
  let step = 0;
  const origin = Date.parse(start);
  return () => new Date(origin + step++ * 1000).toISOString();
}

export function demoBeats(now: () => string = incrementingClock()): ScriptBeat[] {
  return [
    {
      id: "task",
      caption: "Task: Add a title to notes.md.",
      apply: () => setTask(resetDesk(), "Add a title to notes.md."),
    },
    {
      id: "propose",
      caption: "Coworker proposed files.write on notes.md. The sandbox is unchanged.",
      apply: (state) => propose(state),
    },
    {
      id: "policy",
      caption: "Policy check: the write is in scope and still needs approval.",
      apply: (state) => state,
    },
    {
      id: "approve",
      caption: "Approved. The title was written only inside the sandbox.",
      apply: (state) => approve(state, now),
    },
    {
      id: "approved-visible",
      caption: "Audit row recorded. notes.md now starts with the title.",
      apply: (state) => state,
    },
    {
      id: "outside-task",
      caption: "Next task targets a path outside the sandbox.",
      apply: (state) =>
        setTask(state, "Copy notes.md outside the sandbox to ../outside/notes.md"),
    },
    {
      id: "outside-propose",
      caption: "Policy refused ../outside/notes.md. Approve stays disabled.",
      apply: (state) => propose(state),
    },
    {
      id: "outside-hold",
      caption: "A path outside the sandbox cannot be approved.",
      apply: (state) => state,
    },
    {
      id: "deny",
      caption: "Denied. notes.md still has the approved title. Nothing was written outside.",
      apply: (state) => deny(state, now),
    },
  ];
}

export function playDemo(now?: () => string): DeskState {
  return demoBeats(now).reduce((state, beat) => beat.apply(state), resetDesk());
}
