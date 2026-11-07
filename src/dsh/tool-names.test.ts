import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  APPLY_PATCH_TOOL,
  EDIT_TOOL,
  STR_REPLACE_EDITOR_TOOL,
  WRITE_TOOL,
  isMutationTool,
  isShellTool,
} from '@/dsh/tool-names.js';

test('mutation tools are recognised', () => {
  for (const tool of [
    WRITE_TOOL,
    EDIT_TOOL,
    APPLY_PATCH_TOOL,
    STR_REPLACE_EDITOR_TOOL,
  ]) {
    assert.equal(isMutationTool(tool), true);
  }
});

test('non-mutation tools are rejected', () => {
  for (const tool of ['read', 'grep', 'bash', 'pwsh', '']) {
    assert.equal(isMutationTool(tool), false);
  }
});

test('shell tools are recognised', () => {
  assert.equal(isShellTool('bash'), true);
  assert.equal(isShellTool('pwsh'), true);
  assert.equal(isShellTool('write'), false);
  assert.equal(isShellTool('Bash'), false);
});
