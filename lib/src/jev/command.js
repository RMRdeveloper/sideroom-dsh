import { formatJevReport } from './status.js';
export const JEV_COMMAND_NAME = 'jev';
const STATUS_VERB = 'status';
const HELP_VERB = 'help';
export function parseJevCommand(rawInput) {
    const verb = rawInput.trim();
    if (verb === '' || verb === STATUS_VERB) {
        return { kind: 'status' };
    }
    if (verb === HELP_VERB) {
        return { kind: 'help' };
    }
    return { kind: 'unknown', verb };
}
export function jevCommandHelp() {
    return [
        'Jev review control',
        `/${JEV_COMMAND_NAME} ${STATUS_VERB}  configuration, key source, model and call counters`,
        `/${JEV_COMMAND_NAME} ${HELP_VERB}    this message`,
        'The key comes from the environment variable named by jev.keyEnv, or from the stored credential of the same name.',
    ].join('\n');
}
export function createJevCommand({ report, }) {
    return {
        name: JEV_COMMAND_NAME,
        description: 'Show the Jev review status, its key source and its call counters.',
        input: { hint: `[${STATUS_VERB}|${HELP_VERB}]` },
        handler: async ({ rawInput, }) => {
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
