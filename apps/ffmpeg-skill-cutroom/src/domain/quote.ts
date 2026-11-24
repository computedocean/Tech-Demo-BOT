const SAFE = /^[A-Za-z0-9_./:=@%+,-]+$/

export function quoteArg(arg: string): string {
  if (arg.length === 0) return "''"
  if (SAFE.test(arg)) return arg
  return `'${arg.replaceAll("'", `'\\''`)}'`
}

export function formatCommand(argv: readonly string[]): string {
  return argv.map(quoteArg).join(' ')
}
