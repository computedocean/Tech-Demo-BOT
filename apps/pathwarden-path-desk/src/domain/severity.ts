import type { Severity } from "./types.ts";

/**
 * Exposure share of non-Tier Zero accounts.
 * Critical from 95%, High from 80%, Medium from 40%, otherwise Low.
 * Direct control of Tier Zero raises Low and Medium to High.
 */
export function severityBand(share: number, directControl: boolean): Severity {
  let band: Severity;
  if (share >= 0.95) band = "critical";
  else if (share >= 0.8) band = "high";
  else if (share >= 0.4) band = "medium";
  else band = "low";
  if (directControl && (band === "low" || band === "medium")) return "high";
  return band;
}

export const SEVERITY_RANK: Record<Severity, number> = {
  critical: 3,
  high: 2,
  medium: 1,
  low: 0,
};
