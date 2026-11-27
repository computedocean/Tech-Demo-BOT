import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { demoBeats } from "./demo.ts";
import { approve, canApprove, canDeny, deny, propose, resetDesk, setTask } from "./loop.ts";
import { PRESETS } from "./presets.ts";
import { changedPaths } from "./sandbox.ts";
import type { DeskState } from "./types.ts";

const BEAT_MS = 1600;

function lineTone(line: string): string {
  if (line.startsWith("+++") || line.startsWith("---") || line.startsWith("@@")) {
    return "text-muted-foreground";
  }
  if (line.startsWith("+")) return "bg-emerald-50 text-emerald-950";
  if (line.startsWith("-")) return "bg-red-50 text-red-950";
  return "";
}

function DiffBlock({ diff }: { diff: string }) {
  return (
    <pre
      data-testid="diff"
      className="max-h-48 overflow-auto rounded-lg border bg-muted/40 p-2 font-mono text-[11px] leading-5"
    >
      {diff.split("\n").map((line, index) => (
        <div key={`${index}-${line}`} className={lineTone(line)}>
          {line.length > 0 ? line : " "}
        </div>
      ))}
    </pre>
  );
}

export function DeskApp() {
  const [state, setState] = useState<DeskState>(() => resetDesk());
  const [caption, setCaption] = useState("Pick a task, or play the scripted run.");
  const [playing, setPlaying] = useState(false);
  const [beatLabel, setBeatLabel] = useState("Idle");
  const generation = useRef(0);
  const timers = useRef<number[]>([]);

  const clearTimers = useCallback(() => {
    for (const id of timers.current) window.clearTimeout(id);
    timers.current = [];
  }, []);

  const interrupt = useCallback(() => {
    generation.current += 1;
    clearTimers();
    setPlaying(false);
  }, [clearTimers]);

  const play = useCallback(() => {
    clearTimers();
    const run = generation.current + 1;
    generation.current = run;
    const beats = demoBeats();
    let cursor = resetDesk();
    const first = beats[0];
    if (first) {
      cursor = first.apply(cursor);
      setState(cursor);
      setCaption(first.caption);
      setBeatLabel(`1 / ${beats.length}`);
    }
    setPlaying(true);
    for (let index = 1; index < beats.length; index += 1) {
      const beat = beats[index];
      if (!beat) continue;
      const step = index;
      const id = window.setTimeout(() => {
        if (generation.current !== run) return;
        cursor = beat.apply(cursor);
        setState({ ...cursor });
        setCaption(beat.caption);
        setBeatLabel(`${step + 1} / ${beats.length}`);
        if (step === beats.length - 1) setPlaying(false);
      }, step * BEAT_MS);
      timers.current.push(id);
    }
  }, [clearTimers]);

  useEffect(() => {
    const startId = window.setTimeout(() => play(), 0);
    return () => {
      window.clearTimeout(startId);
      generation.current += 1;
      clearTimers();
    };
  }, [play, clearTimers]);

  const ready = canApprove(state) || canDeny(state);
  const approveEnabled = canApprove(state);
  const denyEnabled = canDeny(state);
  const updated = changedPaths(state.sandbox);

  return (
    <div className="flex h-svh flex-col bg-background text-foreground" data-testid="desk-root">
      <header className="flex shrink-0 items-start justify-between gap-4 border-b px-4 py-3">
        <div>
          <p className="text-xs tracking-wide text-muted-foreground uppercase">Independent lab</p>
          <h1 className="text-lg font-medium tracking-tight">Coworker desk</h1>
          <p className="text-sm text-muted-foreground">
            Decide, then record. The sandbox changes only after Approve.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" data-testid="demo-step">
            {playing ? "Playing" : "Ready"} · {beatLabel}
          </Badge>
          <Button type="button" variant="outline" data-testid="play-demo" onClick={play}>
            Play demo
          </Button>
        </div>
      </header>

      <p className="shrink-0 border-b px-4 py-2 text-sm" data-testid="demo-caption">
        {caption}
      </p>

      <main className="grid min-h-0 flex-1 grid-cols-1 gap-3 p-3 lg:grid-cols-[16rem_minmax(0,1.35fr)_minmax(0,1fr)] lg:grid-rows-[minmax(0,1.2fr)_minmax(0,0.9fr)]">
        <Card size="sm" className="min-h-0 lg:row-span-2">
          <CardHeader>
            <CardTitle>Task</CardTitle>
            <CardDescription>Presets stand in for a model. Typed text maps to the nearest one.</CardDescription>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col gap-2">
            <div className="flex flex-col gap-1.5">
              {PRESETS.map((preset) => (
                <Button
                  key={preset.id}
                  type="button"
                  variant={state.task === preset.task ? "secondary" : "outline"}
                  className="h-auto justify-start px-2 py-1.5 text-left whitespace-normal"
                  data-testid={`preset-${preset.id}`}
                  onClick={() => {
                    interrupt();
                    setCaption(`Task set: ${preset.task}`);
                    setState((current) => setTask(current, preset.task));
                  }}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
            <Textarea
              data-testid="task-input"
              value={state.task}
              placeholder="Add a title to notes.md."
              onChange={(event) => {
                interrupt();
                const task = event.target.value;
                setState((current) => setTask(current, task));
              }}
            />
            <Button
              type="button"
              data-testid="propose"
              disabled={state.task.trim().length === 0}
              onClick={() => {
                interrupt();
                setState((current) => propose(current));
                setCaption("Proposal and policy are ready. The sandbox has not changed.");
              }}
            >
              Propose action
            </Button>
          </CardContent>
        </Card>

        <Card size="sm" className="min-h-0" data-testid="proposal">
          <CardHeader>
            <CardTitle>Proposed action</CardTitle>
            <CardDescription>
              {state.proposal
                ? `Nearest preset: ${state.proposal.presetLabel}`
                : "Nothing is proposed yet, so Approve and Deny stay off."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-col gap-2">
            {state.proposal ? (
              <>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="secondary">{state.proposal.tool}</Badge>
                  <Badge variant="outline">{state.proposal.target}</Badge>
                  {state.decision ? (
                    <Badge data-testid="decision-badge">
                      {state.decision === "approved" ? "Approved" : "Denied"}
                    </Badge>
                  ) : (
                    <Badge variant="outline">Awaiting decision</Badge>
                  )}
                </div>
                <p className="text-sm">{state.proposal.summary}</p>
                {state.proposal.diff ? <DiffBlock diff={state.proposal.diff} /> : null}
                {state.proposal.transcript ? (
                  <pre
                    data-testid="transcript"
                    className="max-h-40 overflow-auto rounded-lg border bg-muted/40 p-2 font-mono text-[11px] leading-5 whitespace-pre-wrap"
                  >
                    {state.proposal.transcript}
                  </pre>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                The coworker has not named a tool, a target, or a diff.
              </p>
            )}
          </CardContent>
          <CardFooter className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              data-testid="approve"
              disabled={!approveEnabled}
              onClick={() => {
                interrupt();
                setState((current) => approve(current));
                setCaption("Approved. The sandbox and the audit log were updated together.");
              }}
            >
              Approve
            </Button>
            <Button
              type="button"
              variant="destructive"
              data-testid="deny"
              disabled={!denyEnabled}
              onClick={() => {
                interrupt();
                setState((current) => deny(current));
                setCaption("Denied. The audit log has the refusal, and the sandbox is unchanged.");
              }}
            >
              Deny
            </Button>
            <p className="text-xs text-muted-foreground" data-testid="gate-status">
              {state.blockedReason
                ? state.blockedReason
                : state.decision === "approved"
                  ? "Approved. The audit log has this decision, and the sandbox write already happened."
                  : state.decision === "denied"
                    ? "Denied. The audit log has this refusal. That action did not change the sandbox."
                    : !ready
                      ? "Approve and Deny wait for a proposal and a policy result."
                      : approveEnabled
                        ? "Both decisions are open. Only Approve changes the sandbox."
                        : "Approve is disabled because the policy refused this action."}
            </p>
          </CardFooter>
        </Card>

        <Card size="sm" className="min-h-0" data-testid="policy">
          <CardHeader>
            <CardTitle>Policy check</CardTitle>
            <CardDescription>Runs before any sandbox change.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {state.policy ? (
              <>
                <Badge
                  variant={state.policy.approvable ? "secondary" : "destructive"}
                  data-testid="policy-decision"
                >
                  {state.policy.decision === "needs_approval" ? "Needs approval" : "Refused"}
                </Badge>
                <div>
                  <p className="text-xs text-muted-foreground">Allowed tools</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {state.policy.allowedTools.map((tool) => (
                      <Badge key={tool} variant="outline">
                        {tool}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Path scope</p>
                  <p className="text-sm" data-testid="path-scope">
                    {state.policy.pathScope}
                  </p>
                </div>
                <Separator />
                <p className="text-sm" data-testid="policy-reason">
                  {state.policy.reason}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                No policy result yet. The gateway has nothing to record, and the buttons stay disabled.
              </p>
            )}
          </CardContent>
        </Card>

        <Card size="sm" className="h-full min-h-0" data-testid="sandbox">
          <CardHeader>
            <CardTitle>Sandbox</CardTitle>
            <CardDescription>
              In memory, seeded from bundled fixtures.
              {updated.length > 0 ? ` Updated: ${updated.join(", ")}.` : " No file has changed."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto">
            {state.lastApprovedDiff ? (
              <div data-testid="sandbox-diff">
                <p className="mb-1 text-xs text-muted-foreground">
                  Last approved diff{state.lastApprovedPath ? ` · ${state.lastApprovedPath}` : ""}
                </p>
                <DiffBlock diff={state.lastApprovedDiff} />
              </div>
            ) : null}
            {Object.entries(state.sandbox.files)
              .sort(([left], [right]) => {
                const leftRank = updated.includes(left) ? 0 : 1;
                const rightRank = updated.includes(right) ? 0 : 1;
                if (leftRank !== rightRank) return leftRank - rightRank;
                return left.localeCompare(right);
              })
              .map(([filePath, content]) => (
                <div key={filePath} data-testid={`sandbox-${filePath}`}>
                  <div className="mb-1 flex items-center gap-2">
                    <p className="font-mono text-xs">{filePath}</p>
                    {updated.includes(filePath) ? <Badge>Updated</Badge> : null}
                  </div>
                  <pre className="overflow-auto rounded-md border bg-muted/30 p-2 font-mono text-[11px] leading-5 whitespace-pre-wrap">
                    {content}
                  </pre>
                </div>
              ))}
          </CardContent>
        </Card>

        <Card size="sm" className="h-full min-h-0" data-testid="audit-log">
          <CardHeader>
            <CardTitle>Audit log</CardTitle>
            <CardDescription>
              {state.audit.length === 0
                ? "A proposal does not write a row. Approve or Deny does."
                : `${state.audit.length} decision${state.audit.length === 1 ? "" : "s"} this session.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="min-h-0 flex-1 overflow-auto">
            <div className="flex flex-col gap-2">
              {state.audit.length === 0 ? (
                <p className="text-sm text-muted-foreground">No decisions yet.</p>
              ) : (
                [...state.audit].reverse().map((entry) => (
                  <article key={entry.id} data-testid="audit-entry" className="rounded-lg border p-2">
                    <div className="mb-1 flex flex-wrap items-center gap-1.5">
                      <Badge variant={entry.outcome === "approved" ? "default" : "destructive"}>
                        {entry.outcome}
                      </Badge>
                      <span className="font-mono text-[11px] text-muted-foreground">{entry.timestamp}</span>
                    </div>
                    <p className="text-sm">{entry.task}</p>
                    <p className="text-xs text-muted-foreground">
                      {entry.proposedAction.tool} · {entry.proposedAction.target} · {entry.policyResult.decision}
                    </p>
                    <p className="text-xs">{entry.proposedAction.summary}</p>
                  </article>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </main>

      <footer className="shrink-0 border-t px-4 py-2 text-xs leading-5 text-muted-foreground">
        Independent lab, not an official CopilotKit or OpenBot product. The{" "}
        <a className="underline" href="https://github.com/CopilotKit/OpenBot">
          OpenBot
        </a>{" "}
        application template is MIT. CopilotKit Intelligence is separately licensed — a free local
        license for personal use, a trial for Kubernetes evaluation, and a production license beyond
        that — and is not used here.{" "}
        <a className="underline" href="https://open.bot">
          open.bot
        </a>
      </footer>
    </div>
  );
}
