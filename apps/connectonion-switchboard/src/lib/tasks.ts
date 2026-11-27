import { transcripts } from "@/lib/fixtures"

export type ToolId = "files" | "browser" | "email"

export type ActionTone = "read" | "preview" | "immediate" | "blocked" | "local"

export type Action = {
  title: string
  detail: string
  tone: ActionTone
}

export type Plan = {
  id: string
  tool: ToolId
  task: string
  emailEnabled: boolean
  presetLabel: string
  exact: boolean
  mappingNote: string
  actions: Action[]
  commandText: string
  transcript: string | null
  diff: { file: string; before: string; after: string } | null
  applyMode: "sandbox-write" | "save-transcript" | "disabled"
  applyReason: string
}

type Preset = {
  id: string
  tool: ToolId
  label: string
  words: string[]
}

export const PRESETS: Preset[] = [
  {
    id: "add-title",
    tool: "files",
    label: "Add a title to notes.md",
    words: ["title", "heading", "notes.md", "notes"],
  },
  {
    id: "append-line",
    tool: "files",
    label: "Append a local-only line to notes.md",
    words: ["append", "line", "local", "sandbox"],
  },
  {
    id: "example",
    tool: "browser",
    label: "Open example.com and show the page text",
    words: ["example.com", "example", "page", "text", "open", "show"],
  },
  {
    id: "draft",
    tool: "email",
    label: "Draft a note about the switchboard",
    words: ["draft", "note", "email", "mail", "switchboard"],
  },
]

const TITLE = "# Switchboard notes"
const LOCAL_LINE =
  "- Applied edits stay in apps/connectonion-switchboard/sandbox."

let planSeq = 0

export function presetsFor(tool: ToolId): Preset[] {
  return PRESETS.filter((preset) => preset.tool === tool)
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ")
}

export function resolvePreset(
  tool: ToolId,
  task: string,
): { preset: Preset; exact: boolean } {
  const presets = presetsFor(tool)
  const text = normalize(task)
  const exact = presets.find((preset) => normalize(preset.label) === text)
  if (exact) return { preset: exact, exact: true }

  let best = presets[0]
  let bestScore = -1
  for (const preset of presets) {
    const score = preset.words.reduce(
      (sum, word) => (text.includes(word) ? sum + word.length : sum),
      0,
    )
    if (score > bestScore) {
      best = preset
      bestScore = score
    }
  }
  return { preset: best, exact: false }
}

function nextNotes(presetId: string, before: string): string {
  if (presetId === "add-title") {
    if (before.startsWith(`${TITLE}\n`) || before === TITLE) return before
    return `${TITLE}\n\n${before.replace(/^\n+/, "")}`
  }
  if (before.includes(LOCAL_LINE)) return before
  return `${before.replace(/\s*$/, "")}\n${LOCAL_LINE}\n`
}

function quoteTask(task: string): string {
  return task.trim().replaceAll('"', "'")
}

function filesPlan(
  task: string,
  notes: string,
  emailEnabled: boolean,
  preset: Preset,
  exact: boolean,
): Plan {
  const after = nextNotes(preset.id, notes)
  const unchanged = after === notes
  const mappingNote = exact
    ? "Matched a preset. No model was called."
    : `No model was called. There is no \`co files\` command, so this maps to the nearest sandbox edit: ${preset.label}.`

  return {
    id: `plan-${planSeq++}`,
    tool: "files",
    task,
    emailEnabled,
    presetLabel: preset.label,
    exact,
    mappingNote,
    actions: [
      {
        tone: "read",
        title: "Read notes.md first",
        detail:
          "FileTools.read_file records an MD5 snapshot. An edit without that read is refused.",
      },
      {
        tone: "preview",
        title: "Preview the diff",
        detail: unchanged
          ? "DiffWriter in plan mode finds no further change. Nothing will be written."
          : "DiffWriter(mode=\"plan\").diff shows the unified diff and does not write.",
      },
      {
        tone: "local",
        title: "Apply stays inside the sandbox",
        detail:
          "The approval option is “Yes, apply this change”, and here it can only update sandbox/.runtime.",
      },
    ],
    commandText: [
      "# There is no `co files` command.",
      "# CLI groups grouped as browser & files: co browser, co gdrive, co youtube, co syno.",
      "# Local read/write is the Python SDK. This Bun app does not run it.",
      "",
      "from connectonion.useful_tools import FileTools",
      "from connectonion import DiffWriter",
      "",
      "files = FileTools()",
      'files.read_file("sandbox/notes.md")',
      'DiffWriter(mode="plan").diff("sandbox/notes.md", updated)',
      '# mode="plan" returns the diff and never writes.',
    ].join("\n"),
    transcript: null,
    diff: { file: "notes.md", before: notes, after },
    applyMode: unchanged ? "disabled" : "sandbox-write",
    applyReason: unchanged
      ? "Nothing to write. Preview again after you reset the sandbox or change the task."
      : "Apply writes the previewed notes.md and nothing else.",
  }
}

function browserPlan(
  task: string,
  emailEnabled: boolean,
  preset: Preset,
  exact: boolean,
): Plan {
  const quoted = `co browser "${quoteTask(task)}"`
  const mappingNote = exact
    ? "Matched the no-key preset. The quoted browser agent is not used."
    : `No model was called. A quoted task would become \`${quoted}\`, which needs OPENONION_API_KEY. Showing the nearest no-key preset instead: ${preset.label}.`

  return {
    id: `plan-${planSeq++}`,
    tool: "browser",
    task,
    emailEnabled,
    presetLabel: preset.label,
    exact,
    mappingNote,
    actions: [
      {
        tone: "immediate",
        title: "co browser --headless go_to https://example.com",
        detail:
          "Direct function calls run at once. --yes does not gate go_to. This panel does not launch Chrome.",
      },
      {
        tone: "immediate",
        title: "co browser --headless get_text",
        detail:
          "Prints the visible text of the public example.com page. Recorded here, not executed.",
      },
      {
        tone: "blocked",
        title: "Quoted co browser tasks stay off",
        detail:
          "co browser \"find the price\" needs a model key. co browser import --yes only skips a confirmation prompt.",
      },
    ],
    commandText: [
      mappingNote,
      "",
      "co browser --headless go_to https://example.com",
      "co browser --headless get_current_url",
      "co browser --headless get_text",
      "# Not run: co browser \"…\"",
    ].join("\n"),
    transcript: transcripts.browserSession,
    diff: null,
    applyMode: "save-transcript",
    applyReason:
      "Direct calls would already have run on a real co install. Apply here only saves this recording into the sandbox. It does not open a browser and it is not a --yes gate.",
  }
}

function emailPlan(
  task: string,
  emailEnabled: boolean,
  preset: Preset,
  exact: boolean,
): Plan {
  const planned = exact
    ? 'co gmail draft create ops@example.com "Switchboard note" "The switchboard previews a tool action before Apply. This draft was not sent."'
    : `co gmail draft create ops@example.com "Switchboard note" "${quoteTask(task)}"`

  if (!emailEnabled) {
    return {
      id: `plan-${planSeq++}`,
      tool: "email",
      task,
      emailEnabled,
      presetLabel: preset.label,
      exact,
      mappingNote:
        "Email is optional and off. No login is stored, and no draft command was run.",
      actions: [
        {
          tone: "blocked",
          title: "Email preview is off",
          detail:
            "Turn on Show email preview to read the missing-login recovery and the recorded draft. Apply stays disabled either way.",
        },
      ],
      commandText: [
        "# Email is optional and off by default.",
        "# Apply cannot send. co gmail send is never called.",
        planned,
      ].join("\n"),
      transcript: null,
      diff: null,
      applyMode: "disabled",
      applyReason: "Email Apply is disabled. This demo never sends mail.",
    }
  }

  return {
    id: `plan-${planSeq++}`,
    tool: "email",
    task,
    emailEnabled,
    presetLabel: preset.label,
    exact,
    mappingNote: exact
      ? "Matched the draft preset. The commands below are the documented safe path, not a live mailbox."
      : `No model was called. Nearest preset: ${preset.label}. The recovery and draft transcript are recorded from the docs.`,
    actions: [
      {
        tone: "blocked",
        title: "No Google login",
        detail:
          "Google account not connected. Next: co auth google. A missing Microsoft login prints Next: co auth microsoft.",
      },
      {
        tone: "preview",
        title: "Recorded draft preview",
        detail:
          "draft create, preview, and review do not send. draft send needs --confirm <review-token>. Piped yes cannot approve.",
      },
      {
        tone: "blocked",
        title: "Send stays unreachable",
        detail:
          "co gmail send can send immediately on a real CLI. This demo never calls it, even if a login existed.",
      },
    ],
    commandText: [
      "Google account not connected. Next: co auth google",
      "Next: co auth microsoft",
      "",
      "# Planned draft for this task. Not executed.",
      planned,
      "",
      transcripts.missingLogin,
    ].join("\n"),
    transcript: transcripts.draftPreview,
    diff: null,
    applyMode: "disabled",
    applyReason:
      "Apply is disabled for Email. A draft preview does not send, and this demo will not send even with a live login.",
  }
}

export function buildPlan(input: {
  tool: ToolId
  task: string
  notes: string
  emailEnabled: boolean
}): Plan {
  const { preset, exact } = resolvePreset(input.tool, input.task)
  if (input.tool === "files") {
    return filesPlan(input.task, input.notes, input.emailEnabled, preset, exact)
  }
  if (input.tool === "browser") {
    return browserPlan(input.task, input.emailEnabled, preset, exact)
  }
  return emailPlan(input.task, input.emailEnabled, preset, exact)
}
