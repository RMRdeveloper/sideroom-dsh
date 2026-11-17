import { formatJevReport, type JevReport } from '@/jev/status.js';

export const JEV_COMMAND_NAME = 'jev';
const STATUS_VERB = 'status';
const HELP_VERB = 'help';

export type JevCommandInput
  = | { kind: 'status' }
    | { kind: 'help' }
    | { kind: 'unknown'; verb: string };

export interface JevCommandAnswer {
  kind: 'success' | 'error';
  text: string;
}

export interface JevCommandInvocation {
  rawInput: string;
}

export interface JevCommandDefinition {
  name: string;
  description: string;
  input: { hint: string };
  handler: (invocation: JevCommandInvocation) => Promise<JevCommandAnswer>;
}

export function parseJevCommand(rawInput: string): JevCommandInput {
  const verb = rawInput.trim();
  if (verb === '' || verb === STATUS_VERB) {
    return { kind: 'status' };
  }
  if (verb === HELP_VERB) {
    return { kind: 'help' };
  }
  return { kind: 'unknown', verb };
}

export function jevCommandHelp(): string {
  return [
    'Jev review control',
    `/${JEV_COMMAND_NAME} ${STATUS_VERB}  configuration, key source, model and call counters`,
    `/${JEV_COMMAND_NAME} ${HELP_VERB}    this message`,
    'The key comes from the environment variable named by jev.keyEnv, or from the stored credential of the same name.',
  ].join('\n');
}

export function createJevCommand({
  report,
}: {
  report: () => Promise<JevReport>;
}): JevCommandDefinition {
  return {
    name: JEV_COMMAND_NAME,
    description: 'Show the Jev review status, its key source and its call counters.',
    input: { hint: `[${STATUS_VERB}|${HELP_VERB}]` },
    handler: async ({
      rawInput,
    }: JevCommandInvocation): Promise<JevCommandAnswer> => {
      const command = parseJevCommand(rawInput);
      if (command.kind === 'unknown') {
        return {
          kind: 'error',
          text: `unknown /${JEV_COMMAND_NAME} verb "${command.verb}"; run /${JEV_COMMAND_NAME} ${HELP_VERB}`,
        };
      }
      if (command.kind === 'help') {
        return { kind: 'success', text: jevCommandHelp() };
      }
      return { kind: 'success', text: formatJevReport(await report()) };
    },
  };
}
