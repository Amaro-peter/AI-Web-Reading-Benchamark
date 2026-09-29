import { z } from 'zod';

/**
 * Treat an unset variable and an empty one the same way. `.env.example` ships
 * keys as `GEMINI_API_KEY=`, and an empty key must mean "provider unavailable",
 * not "provider configured with an empty credential".
 */
const optionalSecret = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().trim().min(1).optional(),
);

const optionalNumber = (fallback: number) =>
  z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.coerce.number().int().positive().default(fallback),
  );

export const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: optionalNumber(3001),
  HOST: z.string().min(1).default('0.0.0.0'),
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),

  GEMINI_API_KEY: optionalSecret,
  OPENAI_API_KEY: optionalSecret,
  ANTHROPIC_API_KEY: optionalSecret,

  /**
   * "real" talks to the official SDKs. "mock" uses deterministic in-process
   * providers and is what the test and E2E environments run with, so no test
   * can ever reach a paid API by accident.
   */
  AI_PROVIDER_MODE: z.enum(['real', 'mock']).default('real'),

  /** Hard ceiling on how long a single page fetch may take. */
  SCRAPER_TIMEOUT_MS: optionalNumber(10_000),
  /** Hard ceiling on the response body we are willing to read. */
  SCRAPER_MAX_BYTES: optionalNumber(2_000_000),
  /** Hard ceiling on page text handed to an AI provider. */
  MAX_CONTENT_CHARS: optionalNumber(12_000),
  /** Hard ceiling on how long a single provider answer may take. */
  PROVIDER_TIMEOUT_MS: optionalNumber(30_000),
});

export type Env = z.infer<typeof EnvSchema>;

/**
 * Parses configuration from an environment-like record.
 *
 * Takes the source as an argument instead of reading `process.env` directly so
 * tests can exercise it without mutating global state.
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = EnvSchema.safeParse(source);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    // Only variable names and validation messages — never values, which may be secrets.
    throw new Error(`Invalid environment configuration -> ${details}`);
  }

  return parsed.data;
}

/** The provider ids the benchmark knows about. */
export const PROVIDER_IDS = ['gemini', 'openai', 'claude'] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];

const API_KEY_VARIABLE: Record<ProviderId, keyof Env> = {
  gemini: 'GEMINI_API_KEY',
  openai: 'OPENAI_API_KEY',
  claude: 'ANTHROPIC_API_KEY',
};

/** Name of the environment variable holding a provider's credential. */
export function apiKeyVariableFor(provider: ProviderId): string {
  return API_KEY_VARIABLE[provider];
}

/** The credential for a provider, or undefined when it is not configured. */
export function apiKeyFor(env: Env, provider: ProviderId): string | undefined {
  const value = env[API_KEY_VARIABLE[provider]];
  return typeof value === 'string' ? value : undefined;
}
