export function sceneGlyphs(headline: string) {
  const chars = Array.from(headline)
  if (chars.length === 0) {
    return [{ char: "\u00A0", key: "empty" }]
  }
  return chars.map((char, index) => ({
    char: char === " " ? "\u00A0" : char,
    key: `${index}-${char}`,
  }))
}
