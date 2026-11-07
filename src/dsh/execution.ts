import type { Context } from '@deepseek-ai/cordis';
import type { ToolExecution } from '@deepseek-ai/dsh-tools';
import { isMissingPathError } from '@/errors.js';
import {
  changesOf,
  type MutationInspection,
  type PreviousContent,
} from '@/mutations/changes.js';
import { reportError } from '@/report.js';

interface FsTargetLike {
  readonly targetKey: string;
}

interface FsInfoLike {
  readonly type: string;
}

interface FsService {
  resolve(
    path: string,
    options?: { cwd?: string; signal?: AbortSignal }
  ): Promise<FsTargetLike>;
  stat(
    target: FsTargetLike,
    signal?: AbortSignal
  ): Promise<FsInfoLike | undefined>;
  readText(target: FsTargetLike, signal?: AbortSignal): Promise<string>;
}

interface WorkingDirectoryService {
  get(session: unknown): string;
}

export function tryWorkingDirectory(
  ctx: Context,
  exec: ToolExecution,
): string | undefined {
  try {
    const service = ctx.get('workingDirectory') as
      | WorkingDirectoryService
      | undefined;
    const session = (exec.agent as { session?: unknown } | undefined)?.session;
    if (service === undefined || session === undefined) {
      return undefined;
    }
    return service.get(session);
  } catch (error) {
    reportError(error);
    return undefined;
  }
}

export function workingDirectoryOf(ctx: Context, exec: ToolExecution): string {
  return tryWorkingDirectory(ctx, exec) ?? process.cwd();
}

export async function tryReadPreviousText(
  ctx: Context,
  exec: ToolExecution,
  filePath: string,
): Promise<PreviousContent> {
  const service = ctx.get('fs') as FsService | undefined;
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
  } catch (error) {
    if (!isMissingPathError(error)) {
      reportError(error);
    }
    return { kind: 'absent' };
  }
}

export async function mutationInspectionOf(
  ctx: Context,
  exec: ToolExecution,
): Promise<MutationInspection | null> {
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
