export const WRITE_TOOL = 'write';
export const EDIT_TOOL = 'edit';
export const APPLY_PATCH_TOOL = 'apply_patch';
export const STR_REPLACE_EDITOR_TOOL = 'str_replace_editor';

const MUTATION_TOOLS: ReadonlySet<string> = new Set([
  WRITE_TOOL,
  EDIT_TOOL,
  APPLY_PATCH_TOOL,
  STR_REPLACE_EDITOR_TOOL,
]);

const SHELL_TOOLS: ReadonlySet<string> = new Set(['pwsh', 'bash']);

export function isMutationTool(toolName: string): boolean {
  return MUTATION_TOOLS.has(toolName);
}

export function isShellTool(toolName: string): boolean {
  return SHELL_TOOLS.has(toolName);
}
