import { isMissingPathError } from '../errors.js';
import { changesOf, } from '../mutations/changes.js';
import { reportError } from '../report.js';
export function tryWorkingDirectory(ctx, exec) {
    try {
        const service = ctx.get('workingDirectory');
        const session = exec.agent?.session;
        if (service === undefined || session === undefined) {
            return undefined;
        }
        return service.get(session);
    }
    catch (error) {
        reportError(error);
        return undefined;
    }
}
export function workingDirectoryOf(ctx, exec) {
    return tryWorkingDirectory(ctx, exec) ?? process.cwd();
}
export async function tryReadPreviousText(ctx, exec, filePath) {
    const service = ctx.get('fs');
    if (service === undefined) {
        return { kind: 'absent' };
    }
    try {
        const target = await service.resolve(filePath, {
            cwd: workingDirectoryOf(ctx, exec),
            signal: exec.signal,
        });
        const entry = await service.stat(target, exec.signal);
        if (entry?.type !== 'file') {
            return { kind: 'absent' };
        }
        return { kind: 'text', text: await service.readText(target, exec.signal) };
    }
    catch (error) {
        if (!isMissingPathError(error)) {
            reportError(error);
        }
        return { kind: 'absent' };
    }
}
export async function mutationInspectionOf(ctx, exec) {
    if (exec.agent === undefined) {
        return null;
    }
    const changes = await changesOf({
        toolName: exec.name,
        arguments: exec.arguments,
        readPrevious: (filePath) => tryReadPreviousText(ctx, exec, filePath),
    });
    if (changes === null || changes.length === 0) {
        return null;
    }
    return {
        toolName: exec.name,
        changes,
        callId: String(exec.callId),
        agentId: String(exec.agent.id),
    };
}
