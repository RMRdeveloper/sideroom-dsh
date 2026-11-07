export const RULES = {
    'braced-conditionals': {
        number: 1,
        name: 'Braced conditionals',
        fix: 'wrap the body in braces so the statement cannot bind by indentation',
    },
    'explicit-any': {
        number: null,
        name: 'Explicit any',
        fix: 'name the real type or narrow the value instead of using any',
    },
    'swallowed-errors': {
        number: 5,
        name: 'Explicit error handling',
        fix: 'rethrow with context or let the error propagate; never return a silent default',
    },
    'clear-names': {
        number: 6,
        name: 'Clear names',
        fix: 'name the role or the domain meaning instead of a generic placeholder',
    },
    'stale-comments': {
        number: 19,
        name: 'Comments',
        fix: 'remove the stale marker or replace it with the reason the code needs',
    },
    'commented-code': {
        number: 19,
        name: 'Comments',
        fix: 'delete commented-out code; version control already keeps it',
    },
    'debug-artifacts': {
        number: 19,
        name: 'Debug artifacts',
        fix: 'remove the debug output before finishing',
    },
    'suppressed-type-errors': {
        number: 19,
        name: 'Suppressed type errors',
        fix: 'fix the type error or use @ts-expect-error with a reason; remove @ts-ignore and @ts-nocheck',
    },
};
export const RULE_IDS = Object.keys(RULES);
