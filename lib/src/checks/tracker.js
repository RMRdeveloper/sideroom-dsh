import { detectCheckCommand } from './detect.js';
export function createCheckTracker() {
    const commands = new Map();
    const states = new Map();
    function stateFor(agentId) {
        let status = states.get(agentId);
        if (status === undefined) {
            status = { command: null, green: false };
            states.set(agentId, status);
        }
        return status;
    }
    async function commandFor(cwd) {
        if (commands.has(cwd)) {
            return commands.get(cwd) ?? null;
        }
        const detected = await detectCheckCommand(cwd);
        commands.set(cwd, detected);
        return detected;
    }
    function beginTurn(agentId) {
        states.set(agentId, { command: null, green: false });
    }
    function observeMutation(agentId) {
        commands.clear();
        states.set(agentId, { command: stateFor(agentId).command, green: false });
    }
    async function observeShell({ agentId, cwd, commandLine, }) {
        const detected = await commandFor(cwd);
        if (detected === null || !commandLine.includes(detected.command)) {
            return;
        }
        states.set(agentId, { command: detected.command, green: true });
    }
    async function refresh(agentId, cwd) {
        const status = stateFor(agentId);
        if (status.command !== null) {
            return;
        }
        const detected = await commandFor(cwd);
        if (detected === null) {
            return;
        }
        states.set(agentId, { command: detected.command, green: status.green });
    }
    function statusOf(agentId) {
        return stateFor(agentId);
    }
    return { beginTurn, observeMutation, observeShell, refresh, statusOf };
}
