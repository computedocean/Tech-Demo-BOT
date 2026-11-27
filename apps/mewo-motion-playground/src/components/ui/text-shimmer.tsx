import * as React from "react"
import { cn } from "@/lib/utils"

export interface TextShimmerProps extends Omit<React.ComponentProps<"span">, "children"> {
  children: string
  /** Seconds for one light sweep. */
  duration?: number
}

/**
 * The light is a copy of the text in the foreground colour, seen through a soft-edged window that slides
 * across while the copy slides back the same distance, so the copy holds still under it. Both only change
 * `transform`, which the compositor animates on its own: the text is painted once instead of on every
 * frame, as an animated gradient behind clipped text would be. The copy is generated content
 * (`content: attr(data-text)`), so the string is in the DOM once and find, copy and textContent see it once.
 */
export function TextShimmer({ children, duration = 2, className, style, ...props }: TextShimmerProps) {
  return (
    <span
      data-slot="text-shimmer"
      className={cn("inline-block text-muted-foreground", className)}
      style={{ "--shimmer-duration": `${duration}s`, ...style } as React.CSSProperties}
      {...props}
    >
      {/* Holds the text box the light is measured against, clear of any padding on the root. */}
      <span className="relative inline-block">
        {children}
        <span
          aria-hidden
          data-slot="text-shimmer-light"
          className="pointer-events-none absolute inset-y-0 left-0 w-1/2 overflow-hidden select-none [mask-image:linear-gradient(110deg,transparent,black_50%,transparent)] motion-safe:animate-[mewo-shimmer_var(--shimmer-duration)_linear_infinite] motion-reduce:hidden"
        >
          <span
            data-text={children}
            className="absolute top-0 left-0 w-[200%] text-foreground before:content-[attr(data-text)] motion-safe:animate-[mewo-shimmer-text_var(--shimmer-duration)_linear_infinite]"
          />
        </span>
      </span>
    </span>
  )
}
