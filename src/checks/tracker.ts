import {
  commandMatches,
  detectCheckCommand,
  type CheckCommand,
} from '@/checks/detect.js';

export interface CheckStatus {
  command: string | null;
  green: boolean;
}

export interface ShellStart {
  agentId: string;
  callId: string;
  cwd: string;
  commandLine: string;
}

export interface ShellObservation {
  agentId: string;
  callId: string;
  cwd: string;
  succeeded: boolean;
}

export interface CheckTracker {
  beginTurn(agentId: string, turn: number): void;
  startShell(start: ShellStart): Promise<void>;
  observeMutation(agentId: string, cwd: string): void;
  observeShell(observation: ShellObservation): void;
  refresh(agentId: string, cwd: string): Promise<void>;
  statusOf(agentId: string, cwd: string): CheckStatus;
}

interface DirectoryCheck {
  command: string | null;
  green: boolean;
  version: number;
}

interface StartedCheck {
  agentId: string;
  cwd: string;
  version: number;
}

export function createCheckTracker(): CheckTracker {
  const commands = new Map<string, CheckCommand | null>();
  const directories = new Map<string, Map<string, DirectoryCheck>>();
  const started = new Map<string, StartedCheck>();
  const turns = new Map<string, number>();

  function directoryFor(agentId: string, cwd: string): DirectoryCheck {
    let byDirectory = directories.get(agentId);
    if (byDirectory === undefined) {
      byDirectory = new Map();
      directories.set(agentId, byDirectory);
    }
    let state = byDirectory.get(cwd);
    if (state === undefined) {
      state = { command: null, green: false, version: 0 };
      byDirectory.set(cwd, state);
    }
    return state;
  }

  async function commandFor(cwd: string): Promise<CheckCommand | null> {
    const cached = commands.get(cwd);
    if (cached !== undefined) {
      return cached;
    }
    const detected = await detectCheckCommand(cwd);
    commands.set(cwd, detected);
    return detected;
  }

  function beginTurn(agentId: string, turn: number): void {
    if (turns.get(agentId) === turn) {
      return;
    }
    turns.set(agentId, turn);
    directories.set(agentId, new Map());
    for (const [callId, record] of started) {
      if (record.agentId === agentId) {
        started.delete(callId);
      }
    }
  }

  async function startShell({
    agentId,
    callId,
    cwd,
    commandLine,
  }: ShellStart): Promise<void> {
    const detected = await commandFor(cwd);
    if (detected === null || !commandMatches(commandLine, detected.command)) {
      return;
    }
    const state = directoryFor(agentId, cwd);
    state.command = detected.command;
    started.set(callId, { agentId, cwd, version: state.version });
  }

  function observeMutation(agentId: string, cwd: string): void {
    const state = directoryFor(agentId, cwd);
    state.green = false;
    state.version += 1;
    commands.clear();
  }

  function observeShell({
    agentId,
    callId,
    cwd,
    succeeded,
  }: ShellObservation): void {
    const record = started.get(callId);
    if (record === undefined) {
      return;
    }
    started.delete(callId);
    if (record.agentId !== agentId || record.cwd !== cwd) {
      return;
    }
    const state = directoryFor(agentId, cwd);
    if (record.version !== state.version) {
      return;
    }
    state.green = succeeded;
  }

  async function refresh(agentId: string, cwd: string): Promise<void> {
    const state = directoryFor(agentId, cwd);
    if (state.command !== null) {
      return;
    }
    const detected = await commandFor(cwd);
    if (detected === null) {
      return;
    }
    state.command = detected.command;
  }

  function statusOf(agentId: string, cwd: string): CheckStatus {
    const state = directories.get(agentId)?.get(cwd);
    if (state === undefined) {
      return { command: null, green: false };
    }
    return { command: state.command, green: state.green };
  }

  return {
    beginTurn,
    startShell,
    observeMutation,
    observeShell,
    refresh,
    statusOf,
  };
}
