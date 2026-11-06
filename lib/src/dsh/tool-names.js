export const WRITE_TOOL = 'write';
export const EDIT_TOOL = 'edit';
const MUTATION_TOOLS = new Set([WRITE_TOOL, EDIT_TOOL]);
const SHELL_TOOLS = new Set(['pwsh', 'bash']);
export function isMutationTool(toolName) {
    return MUTATION_TOOLS.has(toolName);
}
export function isShellTool(toolName) {
    return SHELL_TOOLS.has(toolName);
}
