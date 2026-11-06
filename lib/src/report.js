export function reportError(error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`sideroom-dsh: ${message}`);
}
