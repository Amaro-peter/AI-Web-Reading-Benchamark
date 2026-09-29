import type { ApiError, BenchmarkResult } from './types';

/**
 * Base URL of the backend. Only NEXT_PUBLIC_* variables reach the browser,
 * and this is a URL, never a credential — every provider key stays on the
 * backend.
 */
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

/** An error carrying the backend's machine-readable code. */
export class BenchmarkRequestError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'BenchmarkRequestError';
    this.code = code;
  }
}

function isApiError(value: unknown): value is { error: ApiError } {
  if (typeof value !== 'object' || value === null || !('error' in value)) {
    return false;
  }
  const error = (value as { error: unknown }).error;
  return (
    typeof error === 'object' &&
    error !== null &&
    typeof (error as ApiError).code === 'string' &&
    typeof (error as ApiError).message === 'string'
  );
}

interface RunBenchmarkOptions {
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
}

/** Runs one benchmark against the backend. */
export async function runBenchmark(
  url: string,
  options: RunBenchmarkOptions = {},
): Promise<BenchmarkResult> {
  const doFetch = options.fetchImpl ?? fetch;

  let response: Response;
  try {
    response = await doFetch(`${API_BASE_URL}/api/benchmark`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url }),
      ...(options.signal ? { signal: options.signal } : {}),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }
    throw new BenchmarkRequestError(
      'NETWORK_ERROR',
      'Could not reach the benchmark service. Is the backend running?',
    );
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new BenchmarkRequestError('BAD_RESPONSE', 'The service returned a malformed response.');
  }

  if (!response.ok) {
    if (isApiError(body)) {
      throw new BenchmarkRequestError(body.error.code, body.error.message);
    }
    throw new BenchmarkRequestError(
      'UNKNOWN_ERROR',
      `The service responded with ${response.status}.`,
    );
  }

  return body as BenchmarkResult;
}
