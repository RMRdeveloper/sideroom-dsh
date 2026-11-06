export function isMissingPathError(error) {
    if (typeof error !== 'object' || error === null) {
        return false;
    }
    const code = error.code;
    return code === 'ENOENT' || code === 'ENOTDIR';
}
