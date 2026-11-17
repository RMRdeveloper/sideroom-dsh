export const WRITE_TOOL = 'write';
export const EDIT_TOOL = 'edit';
export const APPLY_PATCH_TOOL = 'apply_patch';
export const STR_REPLACE_EDITOR_TOOL = 'str_replace_editor';
export const EXIT_PLAN_MODE_TOOL = 'exit_plan_mode';
export const ASK_USER_QUESTION_TOOL = 'ask_user_question';
export const TODO_WRITE_TOOL = 'todo_write';
const MUTATION_TOOLS = new Set([
    WRITE_TOOL,
    EDIT_TOOL,
    APPLY_PATCH_TOOL,
    STR_REPLACE_EDITOR_TOOL,
]);
const SHELL_TOOLS = new Set(['pwsh', 'bash']);
export function isMutationTool(toolName) {
    return MUTATION_TOOLS.has(toolName);
}
export function isShellTool(toolName) {
    return SHELL_TOOLS.has(toolName);
}
