import type { SampleAsset } from "@/lib/samples"

export function MediaPreview({
  asset,
  compact = false,
}: {
  asset: SampleAsset
  compact?: boolean
}) {
  if (asset.kind === "image") {
    return (
      <img
        src={asset.src}
        alt={asset.alt}
        className={compact ? "h-24 w-full object-cover" : "aspect-video w-full object-cover"}
      />
    )
  }

  if (asset.kind === "video") {
    return (
      <video
        src={asset.src}
        poster="/samples/harbor-still.png"
        controls
        playsInline
        preload="metadata"
        aria-label={asset.alt}
        className={
          compact
            ? "h-24 w-full bg-black object-cover"
            : "aspect-video w-full bg-black object-cover"
        }
      />
    )
  }

  return (
    <div className={compact ? "px-2 py-2" : "flex flex-col gap-3 p-4"}>
      {compact ? null : (
        <div className="flex h-10 items-end gap-1" aria-hidden="true">
          {[18, 28, 14, 36, 22, 40, 16, 30, 12, 24].map((height, index) => (
            <span
              key={index}
              className="w-1.5 rounded-full bg-foreground/70"
              style={{ height }}
            />
          ))}
        </div>
      )}
      <audio
        src={asset.src}
        controls
        preload="metadata"
        className="w-full"
        aria-label={asset.alt}
      />
    </div>
  )
}
