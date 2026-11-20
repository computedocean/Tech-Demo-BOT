import { ClipLibrary } from './components/clip-library.tsx'
import { TrimPanel } from './components/trim-panel.tsx'
import { CaptionPanel } from './components/caption-panel.tsx'
import { PhonePreview } from './components/phone-preview.tsx'
import { AnalyticsPanel } from './components/analytics-panel.tsx'
import { ExportBar } from './components/export-bar.tsx'
import { WeekBoard } from './components/week-board.tsx'
import { DeskFooter } from './components/desk-footer.tsx'
import { Button } from './components/ui/button.tsx'
import { useDesk } from './state/use-desk.ts'

export default function App() {
  const { state, dispatch, clip, draft, filtered, addUpload, removeUpload } = useDesk()
  const queued = state.queue.find((item) => item.id === state.selectedQueueId) ?? null

  return (
    <div className="min-h-svh" data-testid="app-root">
      <header className="border-b border-border/80">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-end justify-between gap-4 px-4 py-4">
          <div className="flex items-center gap-3">
            <svg aria-hidden="true" viewBox="0 0 48 48" className="size-11 text-primary">
              <rect x="1" y="1" width="46" height="46" rx="10" fill="currentColor" opacity="0.16" />
              <rect x="14" y="8" width="6" height="18" rx="1" fill="currentColor" />
              <rect x="22" y="12" width="5" height="14" rx="1" fill="currentColor" opacity="0.7" />
              <rect x="29" y="6" width="5" height="20" rx="1" fill="currentColor" opacity="0.85" />
              <rect x="10" y="30" width="28" height="8" rx="2" fill="currentColor" />
            </svg>
            <div>
              <p className="text-[11px] tracking-[0.16em] text-muted-foreground uppercase">Local planner</p>
              <h1 className="text-xl font-medium tracking-tight">Clip desk</h1>
            </div>
          </div>
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
            Plan a GTA 6 clip page on this machine: library, trim, mock captions, a 9:16 preview, and a weekly
            queue. Nothing here is published.
          </p>
        </div>
      </header>
      <main className="mx-auto flex max-w-[1400px] flex-col gap-4 px-4 py-4">
        <p role="status" data-testid="notice" className="min-h-5 text-sm text-muted-foreground">
          {state.notice}
        </p>
        <div className="grid items-start gap-4 lg:grid-cols-[300px_minmax(0,1fr)_300px]">
          <ClipLibrary
            clips={filtered}
            selectedId={state.selectedId}
            tagFilter={state.tagFilter}
            onFilter={(tag) => dispatch({ type: 'setFilter', tag })}
            onSelect={(clipId) => dispatch({ type: 'selectClip', clipId })}
            onUpload={(file) => void addUpload(file)}
            onRemove={(clipId) => void removeUpload(clipId)}
          />
          <div className="flex flex-col gap-4">
            <TrimPanel
              clip={clip}
              draft={draft}
              onTrim={(trimIn, trimOut) => dispatch({ type: 'setTrim', trimIn, trimOut })}
            />
            <CaptionPanel draft={draft} dispatch={dispatch} />
            <div>
              <Button type="button" data-testid="add-to-queue" onClick={() => dispatch({ type: 'enqueue' })}>
                Add this cut to the week
              </Button>
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <PhonePreview clip={clip} draft={draft} />
            <AnalyticsPanel draft={draft} queued={queued} />
            <ExportBar
              queue={state.queue}
              clip={clip}
              draft={draft}
              onNotice={(notice) => dispatch({ type: 'setNotice', notice })}
            />
          </div>
        </div>
        <WeekBoard
          queue={state.queue}
          selectedId={state.selectedQueueId}
          onSelect={(itemId) => dispatch({ type: 'selectQueueItem', itemId })}
          onReschedule={(itemId, slot) => dispatch({ type: 'reschedule', itemId, slot })}
          onRemove={(itemId) => dispatch({ type: 'removeQueueItem', itemId })}
          onRestore={() => dispatch({ type: 'restoreExample' })}
        />
      </main>
      <DeskFooter />
    </div>
  )
}
