import {
  parseEnvelope,
  readFindings,
  type JevFinding,
  type JevRequestBody,
} from '@/jev/model.js';

export const JEV_FAILURE = {
  quota: 'quota',
  auth: 'auth',
  rateLimited: 'rateLimited',
  transient: 'transient',
  cancelled: 'cancelled',
} as const;

const HTTP_STATUS = {
  unauthorized: 401,
  paymentRequired: 402,
  forbidden: 403,
  tooManyRequests: 429,
  firstClientError: 400,
} as const;

export type JevFailure = (typeof JEV_FAILURE)[keyof typeof JEV_FAILURE];

export interface JevHttpRequest {
  apiKey: string;
  body: string;
  signal: AbortSignal | undefined;
}

export interface JevHttpResponse {
  status: number;
  text: string;
}

export type JevTransport = (
  request: JevHttpRequest,
) => Promise<JevHttpResponse>;

export interface JevAttempt {
  findings: JevFinding[] | undefined;
  model: string | undefined;
  failure: JevFailure | undefined;
}

export interface JevTransportOptions {
  endpoint: string;
  timeoutMs: number;
}

export function createFetchTransport({
  endpoint,
  timeoutMs,
}: JevTransportOptions): JevTransport {
  return async (request) => {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${request.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: request.body,
      signal: requestSignal(timeoutMs, request.signal),
    });
    return { status: response.status, text: await response.text() };
  };
}

export function classifyStatus(status: number): JevFailure | undefined {
  if (status === HTTP_STATUS.unauthorized || status === HTTP_STATUS.forbidden) {
    return JEV_FAILURE.auth;
  }
  if (status === HTTP_STATUS.paymentRequired) {
    return JEV_FAILURE.quota;
  }
  if (status === HTTP_STATUS.tooManyRequests) {
    return JEV_FAILURE.rateLimited;
  }
  if (status >= HTTP_STATUS.firstClientError) {
    return JEV_FAILURE.transient;
  }
  return undefined;
}

export interface AskJevInput {
  transport: JevTransport;
  apiKey: string;
  requestBody: JevRequestBody;
  cutoff: number;
  gate: number;
  signal?: AbortSignal | undefined;
}

export async function askJevRequest({
  transport,
  apiKey,
  requestBody,
  cutoff,
  gate,
  signal,
}: AskJevInput): Promise<JevAttempt> {
  const body = JSON.stringify(requestBody);
  let response: JevHttpResponse;
  try {
    response = await transport({ apiKey, body, signal });
  } catch {
    return {
      findings: undefined,
      model: undefined,
      failure:
        signal?.aborted === true
          ? JEV_FAILURE.cancelled
          : JEV_FAILURE.transient,
    };
  }

  const failure = classifyStatus(response.status);
  if (failure !== undefined) {
    return { findings: undefined, model: undefined, failure };
  }

  const envelope = parseEnvelope(response.text);
  if (envelope?.answers === undefined) {
    return {
      findings: undefined,
      model: envelope?.model,
      failure: JEV_FAILURE.transient,
    };
  }
  return {
    findings: readFindings({
      envelope,
      asked: new Set(Object.keys(requestBody.questions)),
      cutoff,
      gate,
    }),
    model: envelope.model,
    failure: undefined,
  };
}

function requestSignal(
  timeoutMs: number,
  runSignal: AbortSignal | undefined,
): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  if (runSignal === undefined) {
    return timeout;
  }
  return AbortSignal.any([timeout, runSignal]);
}
