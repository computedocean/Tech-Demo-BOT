"use client"

import * as React from "react"
import { motion, useMotionTemplate, useMotionValue, useReducedMotion } from "motion/react"
import { cn } from "@/lib/utils"

export interface SpotlightCardProps extends React.ComponentProps<"div"> {
  /** Any CSS colour. Defaults to a soft tint of the theme foreground, so it shows in light and dark. */
  spotlightColor?: string
}

export function SpotlightCard({
  children,
  spotlightColor = "color-mix(in oklch, var(--color-foreground) 12%, transparent)",
  className,
  onPointerMove,
  ...props
}: SpotlightCardProps) {
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const reduceMotion = useReducedMotion()
  const background = useMotionTemplate`radial-gradient(320px circle at ${x}px ${y}px, ${spotlightColor}, transparent 70%)`

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!reduceMotion) {
      const rect = event.currentTarget.getBoundingClientRect()
      x.set(event.clientX - rect.left)
      y.set(event.clientY - rect.top)
    }
    onPointerMove?.(event)
  }

  return (
    <div
      data-slot="spotlight-card"
      onPointerMove={handlePointerMove}
      className={cn("group relative overflow-hidden rounded-xl border bg-card p-6 text-card-foreground", className)}
      {...props}
    >
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 motion-reduce:hidden"
        style={{ background }}
      />
      <div className="relative">{children}</div>
    </div>
  )
}
