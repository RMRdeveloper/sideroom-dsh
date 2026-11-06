export function reportError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error)
  console.warn(`sideroom-dsh: ${message}`)
}
