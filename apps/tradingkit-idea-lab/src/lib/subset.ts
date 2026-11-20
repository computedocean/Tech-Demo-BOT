const FORBIDDEN: { pattern: RegExp; label: string }[] = [
  { pattern: /request\.security\b/, label: "request.security" },
  { pattern: /\barray\s*\./, label: "arrays" },
  { pattern: /\bmap\s*\./, label: "maps" },
  { pattern: /\bmatrix\s*\./, label: "matrices" },
  { pattern: /strategy\.order\b/, label: "strategy.order" },
  { pattern: /strategy\.cancel\w*/, label: "order cancels" },
]

export function findSubsetViolations(source: string): string[] {
  const hits: string[] = []
  if (!source.includes("//@version=6")) hits.push("missing //@version=6")
  if (!/\bstrategy\s*\(/.test(source)) hits.push("missing strategy()")
  for (const rule of FORBIDDEN) {
    if (rule.pattern.test(source)) hits.push(rule.label)
  }
  return hits
}

export function assertPineSubset(source: string): void {
  const hits = findSubsetViolations(source)
  if (hits.length > 0) {
    throw new Error(`Pine is outside the TradingKit subset: ${hits.join(", ")}.`)
  }
}
