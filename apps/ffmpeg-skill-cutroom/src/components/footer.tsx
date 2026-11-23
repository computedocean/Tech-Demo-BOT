import { Separator } from '@/components/ui/separator.tsx'

export function DeskFooter() {
  return (
    <footer className="mx-auto w-full max-w-6xl px-4 pt-2 pb-10">
      <Separator className="mb-4" />
      <p data-testid="footer-disclaimer" className="text-xs leading-relaxed text-muted-foreground">
        Cut room is an independent demo, not the official ffmpeg-skill product, and it is not affiliated
        with the upstream project. It runs locally, or dry-runs when ffmpeg is missing. The bundled clip is
        a synthetic testsrc2 and sine pattern, not a recording. Tool names and flags follow{' '}
        <a
          className="underline underline-offset-2"
          href="https://github.com/kajisho5/ffmpeg-skill"
        >
          ffmpeg-skill
        </a>{' '}
        4.7.0, MIT. Nothing here posts to Shorts, Reels, or X.
      </p>
    </footer>
  )
}
