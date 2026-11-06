import type { Context } from '@deepseek-ai/cordis'
import type { ToolExecution } from '@deepseek-ai/dsh-tools'
import { isMissingPathError } from '../errors.js'
import type { MutationCall, PreviousContent } from '../mutations/inspector.js'
import { reportError } from '../report.js'

interface FsTargetLike {
  readonly targetKey: string
}

interface FsInfoLike {
  readonly type: string
}

interface FsService {
  resolve(
    path: string,
    options?: { cwd?: string; signal?: AbortSignal }
  ): Promise<FsTargetLike>
  stat(
    target: FsTargetLike,
    signal?: AbortSignal
  ): Promise<FsInfoLike | undefined>
  readText(target: FsTargetLike, signal?: AbortSignal): Promise<string>
}

interface WorkingDirectoryService {
  get(session: unknown): string
}

export function tryWorkingDirectory(
  ctx: Context,
  exec: ToolExecution
): string | undefined {
  try {
    const service = ctx.get('workingDirectory') as
      WorkingDirectoryService | undefined
    const session = (exec.agent as { session?: unknown } | undefined)?.session
    if (service === undefined || session === undefined) {
      return undefined
    }
    return service.get(session)
  } catch (error) {
    reportError(error)
    return undefined
  }
}

export function workingDirectoryOf(ctx: Context, exec: ToolExecution): string {
  return tryWorkingDirectory(ctx, exec) ?? process.cwd()
}

export async function tryReadPreviousText(
  ctx: Context,
  exec: ToolExecution,
  filePath: string
): Promise<PreviousContent> {
  const service = ctx.get('fs') as FsService | undefined
  if (service === undefined) {
    return { kind: 'absent' }
  }
  try {
    const target = await service.resolve(filePath, {
      cwd: workingDirectoryOf(ctx, exec),
      signal: exec.signal,
    })
    const entry = await service.stat(target, exec.signal)
    if (entry === undefined || entry.type !== 'file') {
      return { kind: 'absent' }
    }
    return { kind: 'text', text: await service.readText(target, exec.signal) }
  } catch (error) {
    if (!isMissingPathError(error)) {
      reportError(error)
    }
    return { kind: 'absent' }
  }
}

export function mutationCallOf(
  ctx: Context,
  exec: ToolExecution
): MutationCall | null {
  if (exec.agent === undefined) {
    return null
  }
  return {
    toolName: exec.name,
    arguments: exec.arguments,
    callId: String(exec.callId),
    agentId: String(exec.agent.id),
    readPrevious: (filePath: string) =>
      tryReadPreviousText(ctx, exec, filePath),
  }
}
