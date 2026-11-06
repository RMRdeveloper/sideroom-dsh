export function createPendingNotes() {
    const entries = new Map();
    function remember(callId, note) {
        entries.set(callId, note);
    }
    function take(callId) {
        const note = entries.get(callId);
        entries.delete(callId);
        return note;
    }
    function clear() {
        entries.clear();
    }
    return { remember, take, clear };
}
