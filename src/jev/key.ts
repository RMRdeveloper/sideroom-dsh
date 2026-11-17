import { reportError } from '@/report.js';

export interface JevKey {
  key: string;
  origin: 'environment' | 'credentials';
}

export interface CredentialLookup {
  resolve(ref: string): Promise<{ value: string } | undefined>;
}

export interface KeyResolverOptions {
  environment: Readonly<Record<string, string | undefined>>;
  envName: string;
  credentials: CredentialLookup | undefined;
}

export function createKeyResolver({
  environment,
  envName,
  credentials,
}: KeyResolverOptions): () => Promise<JevKey | undefined> {
  return async () => {
    const fromEnvironment = nonEmpty(environment[envName]);
    if (fromEnvironment !== undefined) {
      return { key: fromEnvironment, origin: 'environment' };
    }
    if (credentials === undefined) {
      return undefined;
    }
    try {
      const stored = await credentials.resolve(envName);
      const value = nonEmpty(stored?.value);
      return value === undefined
        ? undefined
        : { key: value, origin: 'credentials' };
    } catch (error) {
      reportError(error);
      return undefined;
    }
  };
}

function nonEmpty(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}
