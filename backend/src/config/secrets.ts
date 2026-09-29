import { apiKeyFor, PROVIDER_IDS, type Env } from './env.js';

/** Shortest credential worth redacting; below this, matching is meaningless. */
const MIN_SECRET_LENGTH = 8;

/** Every credential currently configured, for use as a redaction list. */
export function collectSecrets(env: Env): string[] {
  return PROVIDER_IDS.map((id) => apiKeyFor(env, id)).filter(
    (value): value is string => value !== undefined && value.length >= MIN_SECRET_LENGTH,
  );
}

/**
 * Replaces any configured credential with a placeholder.
 *
 * This is the last line of defence, not the first: an SDK error message can
 * quote the request it failed on, and that message must never reach a log
 * file or a client. Never rely on this instead of simply not logging secrets.
 */
export function redactSecrets(value: string, secrets: readonly string[]): string {
  let out = value;
  for (const secret of secrets) {
    out = out.split(secret).join('[redacted]');
  }
  return out;
}
