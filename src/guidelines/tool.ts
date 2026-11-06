import type { ToolDefinition } from '@deepseek-ai/dsh-tools'
import { stringArgument } from '../dsh/arguments.js'
import { languageOfPath } from '../languages.js'
import type { RunStore } from '../state/store.js'
import type { Guides } from './guides.js'
import { CONTRACT_SLOT } from './slots.js'

export const GUIDELINES_TOOL_NAME = 'sideroom_guidelines'

export interface GuidelinesToolDeps {
  guides: Guides
  store: RunStore
}

export function createGuidelinesTool({
  guides,
  store,
}: GuidelinesToolDeps): ToolDefinition {
  return {
    name: GUIDELINES_TOOL_NAME,
    description:
      'Load the coding guidelines before editing. Returns the 20 canonical rules plus the guide ' +
      'for the target file language. Call this once per run before the first write/edit: ' +
      'mutations are denied until the matching guide is loaded.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        path: {
          type: 'string',
          description: 'Target file path you are about to write or edit.',
        },
      },
      required: ['path'],
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          language: { type: 'string' },
          content: { type: 'string' },
        },
        required: ['language', 'content'],
      },
      render: (_args, value) => [
        { type: 'text', text: (value as { content: string }).content },
      ],
    },
    async execute(args, exec): Promise<unknown> {
      const target = stringArgument(args, 'path').trim()
      const language = languageOfPath(target)
      const content = guides.load(language)
      if (exec.agent !== undefined) {
        const agentId = String(exec.agent.id)
        store.markLoaded(agentId, CONTRACT_SLOT)
        store.markLoaded(agentId, language)
      }
      return { language, content }
    },
    presentCall: (args) => ({
      card: 'generic',
      title: 'Load coding guidelines',
      kind: 'read',
      rawInput: { path: stringArgument(args, 'path') },
    }),
  }
}
