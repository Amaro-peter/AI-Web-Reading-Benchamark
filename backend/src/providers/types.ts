import type { ProviderId } from '../config/env.js';

export interface AnswerInput {
  pageContent: string;
  question: string;
}

/**
 * The single seam every AI vendor is adapted to.
 *
 * Keeping it this narrow is what makes the rest of the system testable: the
 * benchmark orchestrator and the evaluator never import a vendor SDK.
 */
export interface AIProvider {
  readonly name: string;
  readonly model: string;
  answer(input: AnswerInput): Promise<string>;
}

type ProviderFailureCode =
  'PROVIDER_TIMEOUT' | 'PROVIDER_REFUSED' | 'PROVIDER_ERROR' | 'EMPTY_ANSWER';

/**
 * A provider failure, carrying a message that is safe to return to a client.
 *
 * Vendor SDK errors can echo request details, so the original message is never
 * propagated — only the error class name, which is enough to debug from.
 */
export class ProviderError extends Error {
  readonly code: ProviderFailureCode;

  constructor(code: ProviderFailureCode, message: string) {
    super(message);
    this.name = 'ProviderError';
    this.code = code;
  }

  /** Wraps an unknown SDK rejection without leaking its message. */
  static fromUnknown(provider: string, error: unknown): ProviderError {
    if (error instanceof ProviderError) {
      return error;
    }

    if (error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError')) {
      return new ProviderError('PROVIDER_TIMEOUT', `${provider} did not answer in time.`);
    }

    const kind = error instanceof Error ? error.name : 'UnknownError';
    return new ProviderError('PROVIDER_ERROR', `${provider} request failed (${kind}).`);
  }
}

export interface AvailableProvider {
  id: ProviderId;
  label: string;
  model: string;
  status: 'ok';
  provider: AIProvider;
}

export interface UnavailableProvider {
  id: ProviderId;
  label: string;
  model: string;
  status: 'unavailable';
  /** Why it is unavailable — e.g. the name of the missing env variable. */
  reason: string;
}

export type RegisteredProvider = AvailableProvider | UnavailableProvider;

export function isAvailable(entry: RegisteredProvider): entry is AvailableProvider {
  return entry.status === 'ok';
}
