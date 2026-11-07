const TARGET_PATH_KEYS = ['file_path', 'path'] as const;

export function stringArgument(args: unknown, key: string): string {
  if (args === null || typeof args !== 'object') {
    return '';
  }
  const candidate = (args as Record<string, unknown>)[key];
  return typeof candidate === 'string' ? candidate : '';
}

export function targetPathOf(args: unknown): string | null {
  for (const key of TARGET_PATH_KEYS) {
    const candidate = stringArgument(args, key).trim();
    if (candidate !== '') {
      return candidate;
    }
  }
  return null;
}
