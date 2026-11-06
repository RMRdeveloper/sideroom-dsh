import { detectCheckCommand, type CheckCommand } from './detect.js'

export interface CheckStatus {
  command: string | null
  green: boolean
}

export interface ShellObservation {
  agentId: string
  cwd: string
  commandLine: string
}

export interface CheckTracker {
  beginTurn(agentId: string): void
  observeMutation(agentId: string): void
  observeShell(observation: ShellObservation): Promise<void>
  refresh(agentId: string, cwd: string): Promise<void>
  statusOf(agentId: string): CheckStatus
}

export function createCheckTracker(): CheckTracker {
  const commands = new Map<string, CheckCommand | null>()
  const states = new Map<string, CheckStatus>()

  function stateFor(agentId: string): CheckStatus {
    let status = states.get(agentId)
    if (status === undefined) {
      status = { command: null, green: false }
      states.set(agentId, status)
    }
    return status
  }

  async function commandFor(cwd: string): Promise<CheckCommand | null> {
    if (commands.has(cwd)) {
      return commands.get(cwd) ?? null
    }
    const detected = await detectCheckCommand(cwd)
    commands.set(cwd, detected)
    return detected
  }

  function beginTurn(agentId: string): void {
    states.set(agentId, { command: null, green: false })
  }

  function observeMutation(agentId: string): void {
    commands.clear()
    states.set(agentId, { command: stateFor(agentId).command, green: false })
  }

  async function observeShell({
    agentId,
    cwd,
    commandLine,
  }: ShellObservation): Promise<void> {
    const detected = await commandFor(cwd)
    if (detected === null || !commandLine.includes(detected.command)) {
      return
    }
    states.set(agentId, { command: detected.command, green: true })
  }

  async function refresh(agentId: string, cwd: string): Promise<void> {
    const status = stateFor(agentId)
    if (status.command !== null) {
      return
    }
    const detected = await commandFor(cwd)
    if (detected === null) {
      return
    }
    states.set(agentId, { command: detected.command, green: status.green })
  }

  function statusOf(agentId: string): CheckStatus {
    return stateFor(agentId)
  }

  return { beginTurn, observeMutation, observeShell, refresh, statusOf }
}
