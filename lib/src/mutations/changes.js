import { stringArgument, targetPathOf } from '../dsh/arguments.js';
import { APPLY_PATCH_TOOL, EDIT_TOOL, STR_REPLACE_EDITOR_TOOL, WRITE_TOOL, } from '../dsh/tool-names.js';
import { addedLines } from './added-lines.js';
const ADD_FILE_HEADER = '*** Add File: ';
const UPDATE_FILE_HEADER = '*** Update File: ';
const DELETE_FILE_HEADER = '*** Delete File: ';
const MOVE_HEADER = '*** Move to: ';
function patchPath(header, line) {
    const value = line.slice(header.length).trim();
    if (value === '') {
        return null;
    }
    if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
        return value.slice(1, -1);
    }
    return value;
}
function addPatchLine(current, line) {
    const text = line.slice(1);
    if (text.trim() !== '') {
        current.added.push(text);
    }
}
export function patchChanges(input) {
    if (input.trim() === '') {
        return null;
    }
    const changes = [];
    let current = null;
    for (const line of input.split(/\r?\n/)) {
        if (line.startsWith(ADD_FILE_HEADER)
            || line.startsWith(UPDATE_FILE_HEADER)) {
            const header = line.startsWith(ADD_FILE_HEADER)
                ? ADD_FILE_HEADER
                : UPDATE_FILE_HEADER;
            const path = patchPath(header, line);
            if (current !== null) {
                changes.push(current);
            }
            current = path === null ? null : { path, added: [] };
            continue;
        }
        if (line.startsWith(DELETE_FILE_HEADER)) {
            const path = patchPath(DELETE_FILE_HEADER, line);
            if (current !== null) {
                changes.push(current);
                current = null;
            }
            if (path !== null) {
                changes.push({ path, added: [] });
            }
            continue;
        }
        if (line.startsWith(MOVE_HEADER)) {
            const destination = patchPath(MOVE_HEADER, line);
            if (destination === null) {
                continue;
            }
            if (current === null) {
                current = { path: destination, added: [] };
                continue;
            }
            changes.push({ path: current.path, added: [] });
            current = { path: destination, added: current.added };
            continue;
        }
        if (current !== null && line.startsWith('+')) {
            addPatchLine(current, line);
        }
    }
    if (current !== null) {
        changes.push(current);
    }
    return changes.length === 0 ? null : changes;
}
async function writeChange(source) {
    const target = targetPathOf(source.arguments);
    if (target === null) {
        return null;
    }
    const previous = await source.readPrevious(target);
    const before = previous.kind === 'text' ? previous.text : null;
    return {
        path: target,
        added: addedLines(before, stringArgument(source.arguments, 'content')),
    };
}
function editChange(argumentsValue) {
    const target = targetPathOf(argumentsValue);
    if (target === null) {
        return null;
    }
    return {
        path: target,
        added: addedLines(stringArgument(argumentsValue, 'old_string'), stringArgument(argumentsValue, 'new_string')),
    };
}
function editorChange(argumentsValue) {
    const target = stringArgument(argumentsValue, 'path').trim();
    if (target === '') {
        return null;
    }
    const command = stringArgument(argumentsValue, 'command');
    if (command === 'create') {
        return {
            path: target,
            added: addedLines(null, stringArgument(argumentsValue, 'file_text')),
        };
    }
    if (command === 'str_replace') {
        return {
            path: target,
            added: addedLines(stringArgument(argumentsValue, 'old_str'), stringArgument(argumentsValue, 'new_str')),
        };
    }
    if (command === 'insert') {
        return {
            path: target,
            added: addedLines(null, stringArgument(argumentsValue, 'new_str')),
        };
    }
    return null;
}
export function isMutationCall(toolName, argumentsValue) {
    if (toolName === WRITE_TOOL || toolName === EDIT_TOOL) {
        return true;
    }
    if (toolName === STR_REPLACE_EDITOR_TOOL) {
        const command = stringArgument(argumentsValue, 'command');
        return (command === 'create' || command === 'str_replace' || command === 'insert');
    }
    if (toolName === APPLY_PATCH_TOOL) {
        return patchChanges(stringArgument(argumentsValue, 'input')) !== null;
    }
    return false;
}
export async function changesOf(source) {
    if (source.toolName === WRITE_TOOL) {
        const change = await writeChange(source);
        return change === null ? null : [change];
    }
    if (source.toolName === EDIT_TOOL) {
        const change = editChange(source.arguments);
        return change === null ? null : [change];
    }
    if (source.toolName === STR_REPLACE_EDITOR_TOOL) {
        const change = editorChange(source.arguments);
        return change === null ? null : [change];
    }
    if (source.toolName === APPLY_PATCH_TOOL) {
        return patchChanges(stringArgument(source.arguments, 'input'));
    }
    return null;
}
