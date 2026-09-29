import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { loadEnv } from '../../src/config/env.js';
import { buildApp } from '../../src/http/app.js';
import { ClaudeProvider } from '../../src/providers/claude.js';
import { GeminiProvider } from '../../src/providers/gemini.js';
import { OpenAIProvider } from '../../src/providers/openai.js';
import { createProviders } from '../../src/providers/registry.js';
import { ProviderError } from '../../src/providers/types.js';
import { publicLookup, stubFetch } from '../helpers/page.js';
import { loadFixture } from '../helpers/fixtures.js';

/**
 * API keys must never leave the backend process. These tests assert that at
 * every boundary a key could plausibly escape through: the HTTP response, an
 * error message, the logs, and the source tree itself.
 */

const SECRETS = {
  GEMINI_API_KEY: 'AIzaSy-CANARY-gemini-key-000000000000',
  OPENAI_API_KEY: 'sk-proj-CANARY-openai-key-000000000000',
  ANTHROPIC_API_KEY: 'sk-ant-CANARY-anthropic-key-000000000',
};

const canaries = Object.values(SECRETS);

let app: FastifyInstance | null = null;

afterEach(async () => {
  await app?.close();
  app = null;
});

function expectNoCanary(haystack: string, where: string) {
  for (const secret of canaries) {
    expect(haystack, `${where} must not contain an API key`).not.toContain(secret);
  }
}

describe('the HTTP response never carries a key', () => {
  it('is absent from a successful benchmark response', async () => {
    const env = loadEnv({ NODE_ENV: 'test', ...SECRETS, AI_PROVIDER_MODE: 'mock' });
    const instance = await buildApp({
      env,
      logger: false,
      benchmark: {
        scrapeDeps: { fetchImpl: stubFetch(loadFixture('article')), lookup: publicLookup },
      },
    });
    app = instance;

    const response = await instance.inject({
      method: 'POST',
      url: '/api/benchmark',
      payload: { url: 'https://fixtures.test/article' },
    });

    expect(response.statusCode).toBe(200);
    expectNoCanary(response.body, 'the benchmark response body');
    expectNoCanary(JSON.stringify(response.headers), 'the response headers');
  });

  it('is absent from the health response', async () => {
    const env = loadEnv({ NODE_ENV: 'test', ...SECRETS });
    const instance = await buildApp({ env, logger: false });
    app = instance;

    const response = await instance.inject({ method: 'GET', url: '/api/health' });
    expectNoCanary(response.body, 'the health response');
  });

  it('is absent from an error response', async () => {
    const env = loadEnv({ NODE_ENV: 'test', ...SECRETS });
    const instance = await buildApp({ env, logger: false });
    app = instance;

    for (const url of ['javascript:alert(1)', 'http://127.0.0.1/', 'not-a-url']) {
      const response = await instance.inject({
        method: 'POST',
        url: '/api/benchmark',
        payload: { url },
      });
      expectNoCanary(response.body, `the error response for ${url}`);
    }
  });

  it('is absent when a provider is reported unavailable', async () => {
    const env = loadEnv({ NODE_ENV: 'test', OPENAI_API_KEY: SECRETS.OPENAI_API_KEY });
    const registered = createProviders(env);

    const withoutInstances = registered.map(({ id, label, model, status }) => ({
      id,
      label,
      model,
      status,
    }));
    expectNoCanary(JSON.stringify(withoutInstances), 'the registry');
    // The reason names the variable, never its value.
    const gemini = registered.find((p) => p.id === 'gemini');
    expect(gemini?.status === 'unavailable' && gemini.reason).toContain('GEMINI_API_KEY');
  });
});

describe('provider errors never carry a key', () => {
  it.each([
    [
      'Gemini',
      () =>
        new GeminiProvider({
          apiKey: SECRETS.GEMINI_API_KEY,
          model: 'm',
          maxOutputTokens: 10,
          timeoutMs: 10,
        }),
    ],
    [
      'ChatGPT',
      () =>
        new OpenAIProvider({
          apiKey: SECRETS.OPENAI_API_KEY,
          model: 'm',
          maxOutputTokens: 10,
          timeoutMs: 10,
        }),
    ],
    [
      'Claude',
      () =>
        new ClaudeProvider({
          apiKey: SECRETS.ANTHROPIC_API_KEY,
          model: 'm',
          maxOutputTokens: 10,
          timeoutMs: 10,
        }),
    ],
  ])('%s keeps its key out of the constructed instance surface', (_label, build) => {
    const provider = build();
    expectNoCanary(
      JSON.stringify({ name: provider.name, model: provider.model }),
      'the provider surface',
    );
  });

  it('a wrapped SDK error that quotes the key does not propagate it', () => {
    for (const secret of canaries) {
      const leaky = new Error(`401 Unauthorized: key ${secret} is invalid`);
      const wrapped = ProviderError.fromUnknown('Gemini', leaky);
      expectNoCanary(wrapped.message, 'the wrapped provider error');
      expect(wrapped.message).toBe('Gemini request failed (Error).');
    }
  });

  it('configuration errors name the variable, not the value', () => {
    try {
      loadEnv({ FRONTEND_URL: SECRETS.OPENAI_API_KEY });
      throw new Error('expected loadEnv to reject');
    } catch (error) {
      expectNoCanary((error as Error).message, 'the configuration error');
    }
  });
});

describe('the logs never carry a key', () => {
  /** Builds the app with a real logger writing into `lines`. */
  async function appLoggingInto(
    lines: string[],
    benchmark: Parameters<typeof buildApp>[0]['benchmark'],
  ) {
    const env = loadEnv({ NODE_ENV: 'test', ...SECRETS, AI_PROVIDER_MODE: 'mock' });
    return buildApp({
      env,
      logger: {
        level: 'info',
        stream: {
          write: (line: string) => {
            lines.push(line);
          },
        },
      },
      ...(benchmark === undefined ? {} : { benchmark }),
    });
  }

  it('logs nothing containing a key during a successful run', async () => {
    const lines: string[] = [];
    const instance = await appLoggingInto(lines, {
      scrapeDeps: { fetchImpl: stubFetch(loadFixture('article')), lookup: publicLookup },
    });
    app = instance;

    await instance.inject({
      method: 'POST',
      url: '/api/benchmark',
      payload: { url: 'https://fixtures.test/article' },
    });

    expect(lines.length).toBeGreaterThan(0);
    expectNoCanary(lines.join('\n'), 'the request log');
  });

  it('logs an unexpected failure without echoing a key, and answers generically', async () => {
    const lines: string[] = [];
    const instance = await appLoggingInto(lines, {
      scrapeDeps: { fetchImpl: stubFetch(loadFixture('article')), lookup: publicLookup },
      // Simulates an internal failure whose message happens to quote a key.
      createProvidersFn: () => {
        throw new Error(`provider init failed for key ${SECRETS.OPENAI_API_KEY}`);
      },
    });
    app = instance;

    const response = await instance.inject({
      method: 'POST',
      url: '/api/benchmark',
      payload: { url: 'https://fixtures.test/article' },
    });

    expect(response.statusCode).toBe(500);
    expect(response.json().error).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong.',
    });
    expectNoCanary(response.body, 'the 500 response');

    const logged = lines.join('\n');
    expect(logged).toContain('unhandled error');
    expectNoCanary(logged, 'the error log');
  });
});

describe('the source tree never carries a key', () => {
  const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

  function files(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
      if (entry === 'node_modules' || entry === 'dist' || entry === 'coverage') continue;
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) files(full, out);
      else if (/\.(ts|js|mjs|json|html)$/.test(entry)) out.push(full);
    }
    return out;
  }

  const sources = files(join(backendRoot, 'src')).concat(
    [join(backendRoot, '.env.example')].filter((p) => {
      try {
        statSync(p);
        return true;
      } catch {
        return false;
      }
    }),
  );

  it('has sources to scan', () => {
    expect(sources.length).toBeGreaterThan(10);
  });

  it.each([
    ['an OpenAI-style key', /\bsk-(proj-)?[A-Za-z0-9]{20,}/],
    ['an Anthropic-style key', /\bsk-ant-[A-Za-z0-9-]{20,}/],
    ['a Google-style key', /\bAIza[A-Za-z0-9_-]{30,}/],
  ])('contains no %s', (_label, pattern) => {
    const offenders = sources.filter((file) => pattern.test(readFileSync(file, 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('ships an .env.example with empty credential values', () => {
    const example = readFileSync(join(backendRoot, '.env.example'), 'utf8');
    for (const name of Object.keys(SECRETS)) {
      expect(example).toMatch(new RegExp(`^${name}=\\s*$`, 'm'));
    }
  });
});
