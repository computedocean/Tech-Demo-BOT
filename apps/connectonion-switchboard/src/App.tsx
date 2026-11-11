import { useEffect, useMemo, useState } from "react"
import { FileText, Globe, Mail } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { diffCounts, lineDiff } from "@/lib/diff"
import { transcripts } from "@/lib/fixtures"
import { fetchSandbox, postSandbox } from "@/lib/sandbox-client"
import {
  buildPlan,
  presetsFor,
  type Plan,
  type ToolId,
} from "@/lib/tasks"

const TOOLS: { id: ToolId; label: string; icon: typeof FileText }[] = [
  { id: "files", label: "Files", icon: FileText },
  { id: "browser", label: "Browser", icon: Globe },
  { id: "email", label: "Email", icon: Mail },
]

const TONE: Record<string, string> = {
  read: "Read",
  preview: "Preview",
  immediate: "Runs at once",
  blocked: "Blocked",
  local: "Sandbox only",
}

function sameRequest(
  plan: Plan | null,
  tool: ToolId,
  task: string,
  emailEnabled: boolean,
): boolean {
  if (!plan) return false
  return plan.tool === tool && plan.task === task && plan.emailEnabled === emailEnabled
}

export default function App() {
  const [tool, setTool] = useState<ToolId>("files")
  const [emailEnabled, setEmailEnabled] = useState(false)
  const [task, setTask] = useState("")
  const [files, setFiles] = useState<Record<string, string> | null>(null)
  const [live, setLive] = useState(false)
  const [selectedFile, setSelectedFile] = useState("notes.md")
  const [plan, setPlan] = useState<Plan | null>(null)
  const [appliedId, setAppliedId] = useState<string | null>(null)
  const [status, setStatus] = useState("Preview first. Nothing has changed.")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    void fetchSandbox().then((result) => {
      if (cancelled) return
      setFiles(result.files)
      setLive(result.live)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const visible = sameRequest(plan, tool, task, emailEnabled)
  const rows = useMemo(
    () => (visible && plan?.diff ? lineDiff(plan.diff.before, plan.diff.after) : []),
    [visible, plan],
  )
  const counts = diffCounts(rows)
  const fileNames = files
    ? ["notes.md", "readme.txt", "browser-session.txt"].filter((name) => name in files)
    : []
  const canPreview = task.trim().length > 0 && files !== null && !busy
  const fileStillMatches =
    !plan?.diff || (files !== null && files[plan.diff.file] === plan.diff.before)
  const canApply =
    visible &&
    plan !== null &&
    plan.applyMode !== "disabled" &&
    appliedId !== plan.id &&
    fileStillMatches &&
    !busy

  function onPreview() {
    if (!files || task.trim().length === 0) return
    const next = buildPlan({
      tool,
      task: task.trim(),
      notes: files["notes.md"] ?? "",
      emailEnabled,
    })
    setPlan(next)
    setAppliedId(null)
    setStatus(
      next.applyMode === "disabled"
        ? next.applyReason
        : "Preview held. The sandbox is unchanged.",
    )
  }

  async function onApply() {
    if (!plan || !files || !canApply) return
    setBusy(true)
    try {
      if (plan.applyMode === "sandbox-write" && plan.diff) {
        if (files[plan.diff.file] !== plan.diff.before) {
          setStatus("The file changed since this preview. Preview again.")
          return
        }
        const next = await postSandbox(
          { op: "write", file: plan.diff.file, content: plan.diff.after },
          files,
        )
        setFiles(next.files)
        setLive(next.live)
        setSelectedFile(plan.diff.file)
        setAppliedId(plan.id)
        setStatus(
          "Applied inside sandbox/.runtime. No mail was sent. ~/.co was not touched.",
        )
        return
      }
      if (plan.applyMode === "save-transcript" && plan.transcript) {
        const prior = files["browser-session.txt"] ?? ""
        const gap = prior.length === 0 || prior.endsWith("\n") ? "" : "\n"
        const next = await postSandbox(
          {
            op: "write",
            file: "browser-session.txt",
            content: `${prior}${gap}${plan.transcript}\n`,
          },
          files,
        )
        setFiles(next.files)
        setLive(next.live)
        setSelectedFile("browser-session.txt")
        setAppliedId(plan.id)
        setStatus(
          "Saved the recording in the sandbox. Chrome was not started. Direct browser calls do not wait for --yes.",
        )
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Apply failed.")
    } finally {
      setBusy(false)
    }
  }

  async function onReset() {
    if (!files) return
    setBusy(true)
    try {
      const next = await postSandbox({ op: "reset" }, files)
      setFiles(next.files)
      setLive(next.live)
      setPlan(null)
      setAppliedId(null)
      setSelectedFile("notes.md")
      setStatus("Sandbox reset to the seed files. Nothing outside this app was touched.")
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Reset failed.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-muted/40 text-foreground">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Unofficial demo
            </p>
            <h1 className="text-2xl font-medium tracking-tight">ConnectOnion switchboard</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Preview a tool action, read the planned steps, then Apply. Writes stay in this
              app’s sandbox. Mail is never sent.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">No secrets</Badge>
            <Badge variant="outline">No co binary</Badge>
            <Badge variant="secondary">{live ? "Sandbox API" : "In-memory sandbox"}</Badge>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-4 px-5 py-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Tool</CardTitle>
              <CardDescription>Files and Browser need no login. Email starts off.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Tabs
                value={tool}
                onValueChange={(value) => setTool(value as ToolId)}
              >
                <TabsList className="w-full">
                  {TOOLS.map((item) => {
                    const Icon = item.icon
                    return (
                      <TabsTrigger
                        key={item.id}
                        value={item.id}
                        data-testid={`tool-${item.id}`}
                      >
                        <Icon />
                        {item.label}
                      </TabsTrigger>
                    )
                  })}
                </TabsList>
              </Tabs>
              <ToolNote tool={tool} />
              {tool === "email" ? (
                <label className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
                  <span className="text-sm">
                    Show email preview
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      Off by default. Still cannot send.
                    </span>
                  </span>
                  <Switch
                    checked={emailEnabled}
                    onCheckedChange={setEmailEnabled}
                    data-testid="email-switch"
                    aria-label="Show email preview"
                  />
                </label>
              ) : null}
            </CardContent>
          </Card>

          <Card className="min-h-0">
            <CardHeader>
              <CardTitle>How auth and rate limits work</CardTitle>
              <CardDescription>
                ConnectOnion stores logins together. It does not replace each service.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-80 pr-3">
                <Facts />
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Task</CardTitle>
              <CardDescription>
                Type a task or use a preset. Free text maps to the nearest preset. No model is
                called.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <label className="sr-only" htmlFor="task">
                Task
              </label>
              <Textarea
                id="task"
                data-testid="task-input"
                value={task}
                placeholder="Add a title to notes.md"
                className="field-sizing-fixed min-h-20"
                onChange={(event) => setTask(event.target.value)}
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && canPreview) {
                    event.preventDefault()
                    onPreview()
                  }
                }}
              />
              <div className="flex flex-wrap gap-2">
                {presetsFor(tool).map((preset) => (
                  <Button
                    key={preset.id}
                    type="button"
                    variant="outline"
                    size="sm"
                    data-testid={`preset-${preset.id}`}
                    onClick={() => setTask(preset.label)}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="lg"
                  data-testid="preview-button"
                  disabled={!canPreview}
                  onClick={onPreview}
                >
                  Preview
                </Button>
                <Button
                  type="button"
                  size="lg"
                  variant="secondary"
                  data-testid="apply-button"
                  disabled={!canApply}
                  onClick={() => void onApply()}
                >
                  Apply (--yes)
                </Button>
                <Button
                  type="button"
                  size="lg"
                  variant="outline"
                  data-testid="reset-button"
                  disabled={busy || files === null}
                  onClick={() => void onReset()}
                >
                  Reset sandbox
                </Button>
              </div>
              <p className="text-sm text-muted-foreground" aria-live="polite" data-testid="status">
                {status}
              </p>
              {visible && plan ? (
                <Alert>
                  <AlertTitle>
                    {plan.exact ? "Preset" : "Nearest preset"}: {plan.presetLabel}
                  </AlertTitle>
                  <AlertDescription>{plan.mappingNote}</AlertDescription>
                </Alert>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {plan
                    ? "The task or sandbox changed. Preview again before Apply."
                    : "Apply stays disabled until a preview exists."}
                </p>
              )}
            </CardContent>
          </Card>

          {visible && plan ? (
            <div className="grid gap-4 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Planned actions</CardTitle>
                  <CardDescription>{plan.applyReason}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <ol className="space-y-3">
                    {plan.actions.map((action, index) => (
                      <li key={action.title} className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{index + 1}</span>
                          <Badge variant="outline">{TONE[action.tone]}</Badge>
                          <span className="text-sm font-medium">{action.title}</span>
                        </div>
                        <p className="pl-6 text-sm text-muted-foreground">{action.detail}</p>
                      </li>
                    ))}
                  </ol>
                  <Separator />
                  <pre
                    data-testid="command-view"
                    className="overflow-auto rounded-lg bg-muted p-3 font-mono text-xs leading-5 whitespace-pre-wrap"
                  >
                    {plan.commandText}
                  </pre>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{plan.diff ? "Diff" : "Transcript"}</CardTitle>
                  <CardDescription>
                    {plan.diff
                      ? `${plan.diff.file} · +${counts.added} −${counts.removed}`
                      : "Recorded from the docs. Not a live co run."}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {plan.diff ? (
                    <pre
                      data-testid="diff-view"
                      className="overflow-auto rounded-lg border bg-background font-mono text-xs leading-5"
                    >
                      <div className="px-3 py-1 text-muted-foreground">{`--- a/sandbox/${plan.diff.file}`}</div>
                      <div className="px-3 py-1 text-muted-foreground">{`+++ b/sandbox/${plan.diff.file}`}</div>
                      {rows.map((row, index) => (
                        <div
                          key={`${row.type}-${index}`}
                          className={
                            row.type === "add"
                              ? "bg-emerald-50 px-3 text-emerald-950"
                              : row.type === "del"
                                ? "bg-rose-50 px-3 text-rose-950"
                                : "px-3"
                          }
                        >
                          {row.type === "add" ? "+ " : row.type === "del" ? "- " : "  "}
                          {row.text || " "}
                        </div>
                      ))}
                    </pre>
                  ) : (
                    <pre
                      data-testid="transcript-view"
                      className="overflow-auto rounded-lg bg-muted p-3 font-mono text-xs leading-5 whitespace-pre-wrap"
                    >
                      {plan.transcript}
                    </pre>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Sandbox</CardTitle>
              <CardDescription>
                Seed files live in sandbox/. Apply writes sandbox/.runtime only.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {fileNames.map((name) => (
                  <Button
                    key={name}
                    type="button"
                    size="sm"
                    variant={selectedFile === name ? "default" : "outline"}
                    data-testid={`file-${name}`}
                    onClick={() => setSelectedFile(name)}
                  >
                    {name}
                  </Button>
                ))}
              </div>
              <pre
                data-testid="sandbox-view"
                className="max-h-48 overflow-auto rounded-lg border bg-background p-3 font-mono text-xs leading-5 whitespace-pre-wrap"
              >
                {files?.[selectedFile] ?? "Loading sandbox…"}
              </pre>
            </CardContent>
          </Card>
        </div>
      </main>

      <footer className="mx-auto max-w-6xl px-5 pb-8 text-xs text-muted-foreground">
        ConnectOnion is Apache-2.0, copyright 2024 OpenOnion. This panel quotes short command
        examples from the docs and is not an official product.{" "}
        <a className="underline" href="https://github.com/openonion/connectonion">
          Repo
        </a>
        {" · "}
        <a className="underline" href="https://docs.connectonion.com">
          Docs
        </a>
      </footer>
    </div>
  )
}

function ToolNote({ tool }: { tool: ToolId }) {
  if (tool === "files") {
    return (
      <p className="text-sm text-muted-foreground">
        There is no <code>co files</code> command. This path previews a{" "}
        <code>FileTools</code> / <code>DiffWriter</code> edit in the local sandbox.
      </p>
    )
  }
  if (tool === "browser") {
    return (
      <p className="text-sm text-muted-foreground">
        Direct <code>co browser</code> calls run immediately. The transcript is recorded.
        <code> --yes</code> is not the gate.
      </p>
    )
  }
  return (
    <p className="text-sm text-muted-foreground">
      Without a login the recovery is <code>Next: co auth google</code>. Apply cannot send.
    </p>
  )
}

function Facts() {
  return (
    <div className="space-y-3 text-sm">
      <p>
        <span className="font-medium">Auth is per tool, stored together.</span> Credentials sit
        in <code>~/.co/keys.env</code>, or a file chosen with <code>co --env-file</code>, and
        can be encrypted with <code>co env set … --secret</code>. <code>co auth google</code>{" "}
        and <code>co auth microsoft</code> run browser OAuth through ConnectOnion’s broker.
        Tokens stay on the machine. This demo reads none of them.
      </p>
      <p>
        <span className="font-medium">--yes is not universal.</span> Outlook calendar writes,
        Linear create / update / comment, Canny status changes, <code>co handoff send</code>{" "}
        (<code>--draft --yes</code>), <code>co email transfer complete</code>, and{" "}
        <code>co syno share create|revoke</code> preview until <code>--yes</code>. Gmail’s safe
        path is draft, then review, then <code>draft send --confirm &lt;token&gt;</code>. Piped{" "}
        <code>yes</code> cannot approve, and <code>co gmail send</code> can send immediately.
        Direct browser calls run at once. <code>co browser import --yes</code> only skips a
        confirmation. <code>co init --yes</code> only skips setup prompts. YouTube uploads use{" "}
        <code>--confirm</code>, not a broad <code>--yes</code>.
      </p>
      <p>
        <span className="font-medium">There is no co files command.</span> The docs group
        browser and files as <code>co browser</code>, <code>co gdrive</code>,{" "}
        <code>co youtube</code>, and <code>co syno</code>. Local edits are{" "}
        <code>FileTools</code> and <code>DiffWriter</code>.
      </p>
      <p>
        <span className="font-medium">Rate limits are the provider’s own.</span> ConnectOnion is
        a command line and a local credential store, not a stand-in for each service’s API,
        login, or limits. 1.8.10 built Linear, Canny, and Slack on the service’s own API.
        Documented wrappers: <code>co rem</code> backs off and retries Microsoft Graph HTTP 429
        and reads Outlook four messages at a time while Gmail stays at twenty; OpenOnion Mail
        has <code>co email quota</code>; managed models spend OpenOnion credit (
        <code>co status</code>); the browser daemon has connection and 120s deadline caps. Slack
        rate-limit replies were not exercised live.
      </p>
      <Separator />
      <p className="font-medium">Recorded Outlook preview</p>
      <pre className="overflow-auto rounded-lg bg-muted p-2 font-mono text-[11px] leading-5 whitespace-pre-wrap">
        {transcripts.outlookPreview}
      </pre>
      <p className="text-muted-foreground">
        Linear <code>create</code>, <code>update</code>, and <code>comment</code> preview and
        change nothing until <code>--yes</code>. A read does not wait:
      </p>
      <pre className="overflow-auto rounded-lg bg-muted p-2 font-mono text-[11px] leading-5 whitespace-pre-wrap">
        {transcripts.linearIssues}
      </pre>
    </div>
  )
}
