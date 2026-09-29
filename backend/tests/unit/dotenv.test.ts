import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadDotEnvFile } from '../../src/config/dotenv.js';
import { apiKeyFor, loadEnv } from '../../src/config/env.js';

const TOUCHED = [
  'AWRB_TEST_GEMINI_API_KEY',
  'GEMINI_API_KEY',
  'ANTHROPIC_MODEL',
  'AWRB_TEST_ONLY',
] as const;

let dir: string;
let saved: Record<string, string | undefined>;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'awrb-dotenv-'));
  saved = Object.fromEntries(TOUCHED.map((name) => [name, process.env[name]]));
});

afterEach(() => {
  for (const [name, value] of Object.entries(saved)) {
    if (value === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = value;
    }
  }
});

function writeEnv(contents: string): string {
  const path = join(dir, '.env');
  writeFileSync(path, contents, 'utf8');
  return path;
}

describe('loadDotEnvFile', () => {
  it('reads keys and model overrides out of the file', () => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.ANTHROPIC_MODEL;

    const result = loadDotEnvFile(
      writeEnv('GEMINI_API_KEY=file-gemini-key\nANTHROPIC_MODEL=claude-from-file\n'),
    );

    expect(result.loaded).toBe(true);
    expect(process.env.GEMINI_API_KEY).toBe('file-gemini-key');
    expect(process.env.ANTHROPIC_MODEL).toBe('claude-from-file');
  });

  it('feeds the parsed configuration, so a provider becomes available', () => {
    delete process.env.GEMINI_API_KEY;
    loadDotEnvFile(writeEnv('GEMINI_API_KEY=file-gemini-key\n'));

    expect(apiKeyFor(loadEnv(process.env), 'gemini')).toBe('file-gemini-key');
  });

  it('lets the real environment win, so a deployment overrides a stale file', () => {
    process.env.AWRB_TEST_ONLY = 'from-real-environment';
    loadDotEnvFile(writeEnv('AWRB_TEST_ONLY=from-file\n'));

    expect(process.env.AWRB_TEST_ONLY).toBe('from-real-environment');
  });

  it('is not an error when there is no .env at all', () => {
    const result = loadDotEnvFile(join(dir, 'does-not-exist.env'));

    expect(result.loaded).toBe(false);
    expect(result.reason).toBe('no .env file found');
  });

  it('reports the path it looked at', () => {
    const path = join(dir, 'does-not-exist.env');
    expect(loadDotEnvFile(path).path).toBe(path);
  });

  it('defaults to a .env beside the working directory', () => {
    expect(loadDotEnvFile().path).toBe(join(process.cwd(), '.env'));
  });

  it('never reports the value it read, only whether it loaded', () => {
    delete process.env.GEMINI_API_KEY;
    const result = loadDotEnvFile(writeEnv('GEMINI_API_KEY=super-secret-value\n'));

    expect(JSON.stringify(result)).not.toContain('super-secret-value');
  });
});
