export function createPendingNotes() {
    const entries = new Map();
    function remember(callId, notes) {
        entries.set(callId, [...notes]);
    }
    function take(callId) {
        const entry = entries.get(callId);
        entries.delete(callId);
        return entry;
    }
    function clear() {
        entries.clear();
    }
    return { remember, take, clear };
}
