import path from 'node:path'

export type DestinationRefusal = {
  destination: string
  input: string
}

export function samePath(left: string, right: string): boolean {
  if (left.trim() === '' || right.trim() === '') return false
  return path.resolve(left) === path.resolve(right)
}

/** Refuse a destination that resolves to a declared input. The source is never the output. */
export function findUnsafeDestination(
  destinations: readonly string[],
  declaredInputs: readonly string[],
): DestinationRefusal | null {
  for (const destination of destinations) {
    for (const input of declaredInputs) {
      if (samePath(destination, input)) {
        return { destination, input }
      }
    }
  }
  return null
}
