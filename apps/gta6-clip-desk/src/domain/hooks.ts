export type HookTemplate = {
  id: string
  label: string
  pattern: string
}

export const DEFAULT_HOOK_BANK: readonly HookTemplate[] = [
  { id: 'cold-open', label: 'Cold open', pattern: 'Stay for the last beat of {title}.' },
  { id: 'question', label: 'Question', pattern: 'Would you post {title} like this?' },
  { id: 'beat', label: 'Beat', pattern: 'Three seconds, then {title}.' },
  { id: 'quiet', label: 'Quiet', pattern: '{title}' },
]

export function renderHookPattern(pattern: string, title: string): string {
  const safeTitle = title.trim() || 'Untitled cut'
  const source = pattern.trim() || '{title}'
  return source.replaceAll('{title}', safeTitle)
}

export function copyHookBank(hooks: readonly HookTemplate[] | undefined): HookTemplate[] {
  const source = hooks && hooks.length > 0 ? hooks : DEFAULT_HOOK_BANK
  return source.map((hook) => ({ id: hook.id, label: hook.label, pattern: hook.pattern }))
}
