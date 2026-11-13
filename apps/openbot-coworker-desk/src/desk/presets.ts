import { unifiedDiff } from "./diff.ts";
import type { ProposedAction, Sandbox } from "./types.ts";

export interface Preset {
  id: string;
  label: string;
  task: string;
  phrases: readonly string[];
  tokens: readonly string[];
  build: (sandbox: Sandbox) => ProposedAction;
}

function withPreset(
  preset: Pick<Preset, "id" | "label">,
  action: Omit<ProposedAction, "presetId" | "presetLabel">,
): ProposedAction {
  return {
    presetId: preset.id,
    presetLabel: preset.label,
    ...action,
  };
}

const addTitle: Preset = {
  id: "add-title",
  label: "Add a title to notes.md",
  task: "Add a title to notes.md.",
  phrases: ["add a title", "title to notes", "notes.md"],
  tokens: ["title", "heading", "notes"],
  build(sandbox) {
    const before = sandbox.files["notes.md"] ?? "";
    const after = before.startsWith("# Notes\n") ? before : `# Notes\n\n${before}`;
    return withPreset(this, {
      tool: "files.write",
      target: "notes.md",
      summary: "Insert a level-one title at the top of notes.md.",
      diff: unifiedDiff("notes.md", before, after),
      transcript: null,
      write: { path: "notes.md", content: after },
    });
  },
};

const listFiles: Preset = {
  id: "list-files",
  label: "List the files in the sandbox",
  task: "List the files in the sandbox",
  phrases: ["list the files", "list files", "files in the sandbox"],
  tokens: ["list", "ls", "directory"],
  build(sandbox) {
    const names = Object.keys(sandbox.files).sort();
    return withPreset(this, {
      tool: "files.list",
      target: "sandbox",
      summary: "List the file names in the in-memory sandbox.",
      diff: null,
      transcript: names.join("\n"),
      write: null,
    });
  },
};

const changelog: Preset = {
  id: "changelog",
  label: "Draft a changelog line",
  task: "Draft a changelog line",
  phrases: ["changelog", "draft a changelog"],
  tokens: ["draft", "unreleased"],
  build(sandbox) {
    const before = sandbox.files["CHANGELOG.md"] ?? "# Changelog\n\n## Unreleased\n";
    const line = "- Record the decision before the sandbox changes.";
    const after = before.includes(line)
      ? before
      : before.replace("## Unreleased\n", `## Unreleased\n\n${line}\n`);
    return withPreset(this, {
      tool: "files.write",
      target: "CHANGELOG.md",
      summary: "Append one changelog line under Unreleased.",
      diff: unifiedDiff("CHANGELOG.md", before, after),
      transcript: null,
      write: { path: "CHANGELOG.md", content: after },
    });
  },
};

const readmePreview: Preset = {
  id: "readme-preview",
  label: "Preview the sandbox readme",
  task: "Preview the sandbox readme",
  phrases: ["preview the sandbox", "sandbox readme", "readme"],
  tokens: ["preview", "page"],
  build(sandbox) {
    const body = sandbox.files["readme.md"] ?? "";
    return withPreset(this, {
      tool: "browser.preview",
      target: "sandbox://readme.md",
      summary: "Show a sandboxed preview of readme.md. No page is opened on the network.",
      diff: null,
      transcript: `GET sandbox://readme.md\n\n${body}\nNo network request was made.`,
      write: null,
    });
  },
};

const outsidePath: Preset = {
  id: "outside-path",
  label: "Write outside the sandbox",
  task: "Copy notes.md outside the sandbox to ../outside/notes.md",
  phrases: ["outside the sandbox", "../"],
  tokens: ["outside"],
  build(sandbox) {
    const content = sandbox.files["notes.md"] ?? "";
    return withPreset(this, {
      tool: "files.write",
      target: "../outside/notes.md",
      summary: "Copy notes.md to a path outside the sandbox.",
      diff: unifiedDiff("../outside/notes.md", "", content),
      transcript: null,
      write: { path: "../outside/notes.md", content },
    });
  },
};

const shellCommand: Preset = {
  id: "shell",
  label: "Run a shell command",
  task: "Run a shell command",
  phrases: ["shell command", "run a shell"],
  tokens: ["shell", "bash", "curl"],
  build() {
    return withPreset(this, {
      tool: "shell.exec",
      target: "sandbox",
      summary: "Run a shell command. This lab does not start a shell.",
      diff: null,
      transcript: "$ ls\n# not started — shell.exec is outside the allow list",
      write: null,
    });
  },
};

export const PRESETS: readonly Preset[] = [
  addTitle,
  listFiles,
  changelog,
  readmePreview,
  outsidePath,
  shellCommand,
];

const SAFE_PRESETS = PRESETS.filter(
  (preset) => preset.id !== "outside-path" && preset.id !== "shell",
);

export function presetById(id: string): Preset {
  const preset = PRESETS.find((item) => item.id === id);
  if (!preset) throw new Error(`Unknown preset ${id}`);
  return preset;
}

export function matchPreset(input: string): Preset {
  const text = input.trim().toLowerCase();
  if (text.length === 0) return addTitle;
  if (/(?:\.\.\/|\/etc\/|~\/|outside the sandbox|outside\/)/.test(text)) return outsidePath;
  if (/https?:\/\//.test(text)) return outsidePath;
  if (/\b(shell|bash|curl)\b/.test(text)) return shellCommand;

  let best: Preset = addTitle;
  let bestScore = 0;
  for (const preset of SAFE_PRESETS) {
    let score = 0;
    for (const phrase of preset.phrases) {
      if (text.includes(phrase)) score += phrase.length * 2;
    }
    for (const token of preset.tokens) {
      if (text.split(/[^a-z0-9.]+/).includes(token)) score += 1;
    }
    if (score > bestScore) {
      best = preset;
      bestScore = score;
    }
  }
  return best;
}
