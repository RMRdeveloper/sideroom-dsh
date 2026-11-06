const TARGET_PATH_KEYS = ['file_path', 'path'];
export function stringArgument(args, key) {
    if (args === null || typeof args !== 'object') {
        return '';
    }
    const candidate = args[key];
    return typeof candidate === 'string' ? candidate : '';
}
export function targetPathOf(args) {
    for (const key of TARGET_PATH_KEYS) {
        const candidate = stringArgument(args, key).trim();
        if (candidate !== '') {
            return candidate;
        }
    }
    return null;
}
