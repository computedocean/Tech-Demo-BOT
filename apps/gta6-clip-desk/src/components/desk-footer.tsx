import { Separator } from './ui/separator.tsx'

export function DeskFooter() {
  return (
    <footer className="mx-auto w-full max-w-[1400px] px-4 pt-2 pb-8">
      <Separator className="mb-4" />
      <p data-testid="footer-disclaimer" className="text-xs leading-relaxed text-muted-foreground">
        Clip desk is an independent local planner. It is not affiliated with Rockstar Games, it is not an
        official GTA 6 product, and it does not post anywhere. Analytics are simulated. Bundled clips are
        synthetic placeholders, not game footage. Placeholder video is generated with ffmpeg from flat colors
        and dedicated CC0. See public/clips/SOURCE.txt. Campaign pay, view counts, and earnings in clipping jobs
        are simulated sample figures for planning, not a payment and not a forecast.
      </p>
    </footer>
  )
}
