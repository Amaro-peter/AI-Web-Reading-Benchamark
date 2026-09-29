import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

export interface DotEnvResult {
  /** Absolute path that was looked at. */
  path: string;
  loaded: boolean;
  /** Why it was not loaded, when it was not. */
  reason?: string;
}

/**
 * Loads `.env` into process.env for local development.
 *
 * Uses Node's built-in `process.loadEnvFile`, so there is no dotenv
 * dependency. Two properties matter:
 *
 *  - a variable already present in the real environment WINS over the file.
 *    On Railway and Vercel the platform injects the credentials, and a stale
 *    `.env` left in an image must never override them;
 *  - a missing or unreadable file is not an error. Running with no `.env` at
 *    all is the normal production case, and it is also how the service starts
 *    with every provider simply marked unavailable.
 */
export function loadDotEnvFile(path: string = resolve(process.cwd(), '.env')): DotEnvResult {
  if (!existsSync(path)) {
    return { path, loaded: false, reason: 'no .env file found' };
  }

  try {
    process.loadEnvFile(path);
    return { path, loaded: true };
  } catch (error) {
    // A malformed .env must not stop the service from booting.
    const kind = error instanceof Error ? error.name : 'UnknownError';
    return { path, loaded: false, reason: `.env could not be parsed (${kind})` };
  }
}
