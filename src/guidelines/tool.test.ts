import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createGuidelinesTool,
  GUIDELINES_TOOL_NAME,
} from '@/guidelines/tool.js';
import { createRunStore } from '@/state/store.js';

function setup(): {
  definition: ReturnType<typeof createGuidelinesTool>;
  calls: string[];
  store: ReturnType<typeof createRunStore>;
} {
  const calls: string[] = [];
  const guides = {
    load: (language: string): string => {
      calls.push(language);
      return `content:${language}`;
    },
  };
  const store = createRunStore();
  store.beginTurn('agent-1', 1);
  return {
    definition: createGuidelinesTool({ guides, store }),
    calls,
    store,
  };
}

test('the tool is registered under its public name', () => {
  const { definition } = setup();
  assert.equal(GUIDELINES_TOOL_NAME, 'sideroom_guidelines');
  assert.equal(definition.name, 'sideroom_guidelines');
  assert.equal(
    definition.description,
    'Load the coding guidelines before editing. Returns the 20 canonical rules plus the guide '
    + 'for the target file language. Call this once per run before the first write/edit: '
    + 'mutations are denied until the matching guide is loaded.',
  );
});

test('the tool schema requires one path', () => {
  const { definition } = setup();
  assert.deepEqual(definition.parameters, {
    type: 'object',
    additionalProperties: false,
    properties: {
      path: {
        type: 'string',
        description: 'Target file path you are about to write or edit.',
      },
    },
    required: ['path'],
  });
  assert.deepEqual(definition.output?.schema, {
    type: 'object',
    additionalProperties: false,
    properties: {
      language: { type: 'string' },
      content: { type: 'string' },
    },
    required: ['language', 'content'],
  });
});

test('execute trims the path and marks both slots for the agent', async () => {
  const { definition, calls, store } = setup();
  const result = await definition.execute(
    { path: '  src/app.ts  ' },
    { agent: { id: 'agent-1' } } as never,
  );
  assert.deepEqual(result, {
    language: 'typescript',
    content: 'content:typescript',
  });
  assert.deepEqual(calls, ['typescript']);
  assert.equal(store.isLoaded('agent-1', 'contract'), true);
  assert.equal(store.isLoaded('agent-1', 'typescript'), true);
});

test('execute returns the shared contract for an unknown language', async () => {
  const { definition, calls, store } = setup();
  const result = await definition.execute(
    { path: 'notes.md' },
    { agent: { id: 'agent-1' } } as never,
  );
  assert.deepEqual(result, {
    language: 'general',
    content: 'content:general',
  });
  assert.deepEqual(calls, ['general']);
  assert.equal(store.isLoaded('agent-1', 'general'), true);
});

test('execute does not mark slots without an agent', async () => {
  const { definition, store } = setup();
  const result = await definition.execute({ path: 'src/app.ts' }, {} as never);
  assert.deepEqual(result, {
    language: 'typescript',
    content: 'content:typescript',
  });
  assert.equal(store.isLoaded('agent-1', 'contract'), false);
});

test('execute tolerates a missing path', async () => {
  const { definition, calls } = setup();
  const result = await definition.execute({}, { agent: { id: 'agent-1' } } as never);
  assert.deepEqual(result, {
    language: 'general',
    content: 'content:general',
  });
  assert.deepEqual(calls, ['general']);
});

test('render returns the content as one text block', () => {
  const { definition } = setup();
  const rendered = definition.output?.render?.({}, {
    language: 'typescript',
    content: 'the content',
  });
  assert.deepEqual(rendered, [{ type: 'text', text: 'the content' }]);
});

test('presentCall describes the target read', () => {
  const { definition } = setup();
  assert.deepEqual(definition.presentCall?.({ path: 'src/app.ts' }), {
    card: 'generic',
    title: 'Load coding guidelines',
    kind: 'read',
    rawInput: { path: 'src/app.ts' },
  });
  assert.deepEqual(definition.presentCall?.({}), {
    card: 'generic',
    title: 'Load coding guidelines',
    kind: 'read',
    rawInput: { path: '' },
  });
});
