export const WRITE_TOOL = 'write'
export const EDIT_TOOL = 'edit'

const MUTATION_TOOLS: ReadonlySet<string> = new Set([WRITE_TOOL, EDIT_TOOL])

const SHELL_TOOLS: ReadonlySet<string> = new Set(['pwsh', 'bash'])

export function isMutationTool(toolName: string): boolean {
  return MUTATION_TOOLS.has(toolName)
}

export function isShellTool(toolName: string): boolean {
  return SHELL_TOOLS.has(toolName)
}
