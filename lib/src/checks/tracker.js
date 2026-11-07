import { commandMatches, detectCheckCommand, } from './detect.js';
export function createCheckTracker() {
    const commands = new Map();
    const directories = new Map();
    const started = new Map();
    const turns = new Map();
    function directoryFor(agentId, cwd) {
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
    async function commandFor(cwd) {
        const cached = commands.get(cwd);
        if (cached !== undefined) {
            return cached;
        }
        const detected = await detectCheckCommand(cwd);
        commands.set(cwd, detected);
        return detected;
    }
    function beginTurn(agentId, turn) {
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
    async function startShell({ agentId, callId, cwd, commandLine, }) {
        const detected = await commandFor(cwd);
        if (detected === null || !commandMatches(commandLine, detected.command)) {
            return;
        }
        const state = directoryFor(agentId, cwd);
        state.command = detected.command;
        started.set(callId, { agentId, cwd, version: state.version });
    }
    function observeMutation(agentId, cwd) {
        const state = directoryFor(agentId, cwd);
        state.green = false;
        state.version += 1;
        commands.clear();
    }
    function observeShell({ agentId, callId, cwd, succeeded, }) {
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
    async function refresh(agentId, cwd) {
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
    function statusOf(agentId, cwd) {
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
