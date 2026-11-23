import { spawn, spawnSync } from 'node:child_process'

export type CommandResult = {
  code: number
  stdout: string
  stderr: string
}

export function commandOnPath(bin: string): boolean {
  const result = spawnSync(bin, ['-version'], { shell: false, stdio: 'ignore' })
  return result.status === 0
}

export function runCommand(argv: string[], cwd?: string): Promise<CommandResult> {
  const [bin, ...args] = argv
  if (!bin) return Promise.resolve({ code: 127, stdout: '', stderr: 'empty command' })
  return new Promise((resolve) => {
    const child = spawn(bin, args, { shell: false, cwd, timeout: 120_000 })
    let stdout = ''
    let stderr = ''
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk
    })
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk
    })
    child.on('error', (error) => {
      resolve({ code: 127, stdout, stderr: `${stderr}\n${error.message}`.trim() })
    })
    child.on('close', (code) => {
      resolve({ code: code ?? 1, stdout, stderr })
    })
  })
}
