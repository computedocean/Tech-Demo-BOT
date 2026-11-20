const TOKEN_ENV = "TREG_TOKEN"

export type GenerationMode = {
  mode: "mock"
  treg: "off"
  liveCall: false
  supercomputer: "stand-in"
  liveComputers: false
  remoteAgent: false
  reason: string
}

export function resolveGenerationMode(
  env: Record<string, string | undefined>,
): GenerationMode {
  const present = Boolean(env[TOKEN_ENV]?.trim())
  return {
    mode: "mock",
    treg: "off",
    liveCall: false,
    supercomputer: "stand-in",
    liveComputers: false,
    remoteAgent: false,
    reason: present
      ? "A server token is present. Live Treg stays off in this lab, so generation uses bundled samples."
      : "No server token is set. Mock mode is the default.",
  }
}

export function publicModePayload(
  env: Record<string, string | undefined>,
): GenerationMode {
  return resolveGenerationMode(env)
}
