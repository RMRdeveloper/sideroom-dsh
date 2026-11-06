export const RULES = {
    'braced-conditionals': {
        number: 1,
        name: 'Braced conditionals',
        fix: 'wrap the body in braces so the statement cannot bind by indentation',
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
};
export const RULE_IDS = Object.keys(RULES);
