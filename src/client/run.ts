export function runInBackground(promise: Promise<void>): void {
  promise.catch((error: unknown) => {
    console.error('sideroom-dsh: a Jev request failed', error);
  });
}
