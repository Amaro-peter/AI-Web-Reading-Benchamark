import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { MockProvider } from '../../src/providers/mock.js';
import type { RegisteredProvider } from '../../src/providers/types.js';
import { buildTestApp, VALID_URL } from '../helpers/app.js';

let app: FastifyInstance | null = null;

afterEach(async () => {
  await app?.close();
  app = null;
});

const providers: RegisteredProvider[] = [
  {
    id: 'gemini',
    label: 'Gemini',
    model: 'mock',
    status: 'ok',
    provider: new MockProvider({ name: 'gemini', model: 'mock' }),
  },
];

async function post(payload: unknown, options: Parameters<typeof buildTestApp>[0] = {}) {
  const instance = await buildTestApp({ providers, ...options });
  app = instance;
  return instance.inject({
    method: 'POST',
    url: '/api/benchmark',
    payload: payload as object,
  });
}

describe('oversized input', () => {
  it('rejects a URL beyond the length limit', async () => {
    const response = await post({ url: `https://example.com/${'a'.repeat(5000)}` });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('INVALID_URL');
  });

  it('rejects a request body beyond the body limit', async () => {
    const instance = await buildTestApp({ providers });
    app = instance;
    const response = await instance.inject({
      method: 'POST',
      url: '/api/benchmark',
      payload: { url: VALID_URL, padding: 'x'.repeat(64 * 1024) },
    });

    expect(response.statusCode).toBe(413);
  });

  it('refuses to read a page beyond the byte budget', async () => {
    const response = await post(
      { url: VALID_URL },
      {
        env: { SCRAPER_MAX_BYTES: '2000' },
        fetchImpl: async () =>
          new Response(
            `<html><body><article><p>${'word '.repeat(50_000)}</p></article></body></html>`,
            {
              status: 200,
              headers: { 'content-type': 'text/html' },
            },
          ),
      },
    );

    expect(response.statusCode).toBe(413);
    expect(response.json().error.code).toBe('RESPONSE_TOO_LARGE');
  });

  it('caps the text handed to a model even when the page is within the byte budget', async () => {
    const body = (
      await post(
        { url: VALID_URL },
        {
          env: { MAX_CONTENT_CHARS: '600' },
        },
      )
    ).json();

    expect(body.page.truncated).toBe(true);
    // The word count still describes the page, so a reader sees what was cut.
    expect(body.page.wordCount).toBeGreaterThan(300);
  });
});

describe('malformed input', () => {
  it.each([{ url: null }, { url: [] }, { url: {} }, { url: true }])(
    'rejects %j without crashing',
    async (payload) => {
      const response = await post(payload);
      expect(response.statusCode).toBe(400);
    },
  );

  it('survives a page that is valid HTML but semantically empty', async () => {
    const response = await post({ url: VALID_URL }, { html: 'empty' });
    expect([400, 502]).toContain(response.statusCode);
    expect(response.json().error.code).toBe('EMPTY_CONTENT');
  });
});
