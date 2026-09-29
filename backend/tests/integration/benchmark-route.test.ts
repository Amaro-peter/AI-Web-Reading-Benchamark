import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { FailingProvider, MockProvider, ScriptedProvider } from '../../src/providers/mock.js';
import type { RegisteredProvider } from '../../src/providers/types.js';
import { buildTestApp, VALID_URL } from '../helpers/app.js';

let app: FastifyInstance | null = null;

afterEach(async () => {
  await app?.close();
  app = null;
});

async function post(body: unknown, options: Parameters<typeof buildTestApp>[0] = {}) {
  const instance = await buildTestApp(options);
  app = instance;
  return instance.inject({ method: 'POST', url: '/api/benchmark', payload: body as object });
}

const mockLineUp: RegisteredProvider[] = [
  {
    id: 'gemini',
    label: 'Gemini',
    model: 'mock-g',
    status: 'ok',
    provider: new MockProvider({ name: 'gemini', model: 'mock-g' }),
  },
  {
    id: 'openai',
    label: 'ChatGPT',
    model: 'mock-o',
    status: 'ok',
    provider: new MockProvider({ name: 'openai', model: 'mock-o' }),
  },
  {
    id: 'claude',
    label: 'Claude',
    model: 'mock-c',
    status: 'ok',
    provider: new MockProvider({ name: 'claude', model: 'mock-c' }),
  },
];

describe('POST /api/benchmark — the whole flow', () => {
  it('runs HTTP -> validation -> scraping -> benchmark -> providers -> evaluation -> response', async () => {
    const response = await post({ url: VALID_URL }, { providers: mockLineUp });
    expect(response.statusCode).toBe(200);

    const body = response.json();
    expect(body.url).toBe(VALID_URL);
    expect(body.page.title).toBe("Lisbon's tram network turns 150");
    expect(body.page.wordCount).toBeGreaterThan(300);
    expect(body.questions).toHaveLength(5);
    expect(Object.keys(body.results).sort()).toEqual(['claude', 'gemini', 'openai']);
    expect(body.disclaimer).toContain('Experimental');
  });

  it('returns the response shape the API contract promises', async () => {
    const body = (await post({ url: VALID_URL }, { providers: mockLineUp })).json();

    expect(Object.keys(body)).toEqual(
      expect.arrayContaining(['url', 'page', 'questions', 'results']),
    );
    for (const question of body.questions) {
      expect(question).toMatchObject({
        id: expect.any(String),
        category: expect.stringMatching(/^(EXTRACTION|COMPREHENSION|RELATION)$/),
        prompt: expect.any(String),
      });
    }
    for (const result of Object.values<Record<string, unknown>>(body.results)) {
      expect(result).toMatchObject({
        id: expect.any(String),
        label: expect.any(String),
        model: expect.any(String),
        status: expect.stringMatching(/^(ok|unavailable|error)$/),
      });
    }
  });

  it('grades every answer it received', async () => {
    const body = (await post({ url: VALID_URL }, { providers: mockLineUp })).json();

    for (const answer of body.results.gemini.answers) {
      expect(answer.verdict).toMatch(/^(CORRECT|PARTIAL|INCORRECT|NOT_EVALUABLE)$/);
      expect(answer.score).toBeGreaterThanOrEqual(0);
      expect(answer.score).toBeLessThanOrEqual(1);
    }
    expect(body.results.gemini.scores.byCategory).toHaveProperty('EXTRACTION');
  });
});

describe('request validation', () => {
  const invalidBodies: [unknown, string][] = [
    [{}, 'a missing url'],
    [{ url: '' }, 'an empty url'],
    [{ url: 123 }, 'a non-string url'],
    [{ url: VALID_URL, extra: 'field' }, 'an unexpected field'],
    [[1, 2, 3], 'an array body'],
    [null, 'a null body'],
  ];

  it.each(invalidBodies)('rejects %j (%s) with 400', async (payload) => {
    const response = await post(payload, { providers: mockLineUp });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('INVALID_REQUEST');
  });

  it('rejects a body that is not JSON with 415', async () => {
    const instance = await buildTestApp({ providers: mockLineUp });
    app = instance;
    const response = await instance.inject({
      method: 'POST',
      url: '/api/benchmark',
      payload: 'url=https://example.com',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
    });
    expect(response.statusCode).toBe(415);
  });

  it.each([
    ['javascript:alert(1)', 'UNSUPPORTED_SCHEME'],
    ['file:///etc/passwd', 'UNSUPPORTED_SCHEME'],
    ['not a url at all', 'INVALID_URL'],
    ['http://127.0.0.1/admin', 'BLOCKED_HOST'],
    ['http://169.254.169.254/latest/meta-data/', 'BLOCKED_HOST'],
  ])('rejects the url %s with %s', async (url, code) => {
    const response = await post({ url }, { providers: mockLineUp });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe(code);
  });
});

describe('scraping failures', () => {
  it('reports a page with no readable content', async () => {
    const response = await post({ url: VALID_URL }, { providers: mockLineUp, html: 'empty' });
    expect(response.statusCode).toBe(502);
    expect(response.json().error.code).toBe('EMPTY_CONTENT');
  });

  it('reports an upstream HTTP error', async () => {
    const response = await post(
      { url: VALID_URL },
      {
        providers: mockLineUp,
        fetchImpl: async () =>
          new Response('gone', { status: 404, headers: { 'content-type': 'text/html' } }),
      },
    );
    expect(response.statusCode).toBe(502);
    expect(response.json().error.code).toBe('HTTP_ERROR');
  });

  it('reports a fetch timeout as 504', async () => {
    const response = await post(
      { url: VALID_URL },
      {
        providers: mockLineUp,
        fetchImpl: () => Promise.reject(Object.assign(new Error('x'), { name: 'AbortError' })),
      },
    );
    expect(response.statusCode).toBe(504);
    expect(response.json().error.code).toBe('TIMEOUT');
  });

  it('reports an oversized page as 413', async () => {
    const response = await post(
      { url: VALID_URL },
      {
        providers: mockLineUp,
        env: { SCRAPER_MAX_BYTES: '500' },
        fetchImpl: async () =>
          new Response('<html><body>' + 'x'.repeat(50_000) + '</body></html>', {
            status: 200,
            headers: { 'content-type': 'text/html' },
          }),
      },
    );
    expect(response.statusCode).toBe(413);
    expect(response.json().error.code).toBe('RESPONSE_TOO_LARGE');
  });

  it('reports a non-HTML response', async () => {
    const response = await post(
      { url: VALID_URL },
      {
        providers: mockLineUp,
        fetchImpl: async () =>
          new Response('{"a":1}', { status: 200, headers: { 'content-type': 'application/json' } }),
      },
    );
    expect(response.statusCode).toBe(502);
    expect(response.json().error.code).toBe('UNSUPPORTED_CONTENT_TYPE');
  });
});

describe('provider availability', () => {
  it('still returns 200 when every provider is unavailable', async () => {
    const response = await post(
      { url: VALID_URL },
      {
        providers: [
          {
            id: 'gemini',
            label: 'Gemini',
            model: 'x',
            status: 'unavailable',
            reason: 'GEMINI_API_KEY is not configured.',
          },
          {
            id: 'openai',
            label: 'ChatGPT',
            model: 'x',
            status: 'unavailable',
            reason: 'OPENAI_API_KEY is not configured.',
          },
          {
            id: 'claude',
            label: 'Claude',
            model: 'x',
            status: 'unavailable',
            reason: 'ANTHROPIC_API_KEY is not configured.',
          },
        ],
      },
    );

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.questions).toHaveLength(5);
    for (const result of Object.values<{ status: string; scores: unknown }>(body.results)) {
      expect(result.status).toBe('unavailable');
      expect(result.scores).toBeNull();
    }
  });

  it('runs the available providers when one key is missing', async () => {
    const response = await post(
      { url: VALID_URL },
      {
        providers: [
          {
            id: 'gemini',
            label: 'Gemini',
            model: 'x',
            status: 'unavailable',
            reason: 'GEMINI_API_KEY is not configured.',
          },
          mockLineUp[1] as RegisteredProvider,
          mockLineUp[2] as RegisteredProvider,
        ],
      },
    );

    const body = response.json();
    expect(body.results.gemini.status).toBe('unavailable');
    expect(body.results.openai.status).toBe('ok');
    expect(body.results.claude.status).toBe('ok');
    expect(body.results.openai.answers).toHaveLength(5);
  });

  it('keeps going when one provider errors on every call', async () => {
    const response = await post(
      { url: VALID_URL },
      {
        providers: [
          {
            id: 'gemini',
            label: 'Gemini',
            model: 'broken',
            status: 'ok',
            provider: new FailingProvider('gemini', 'broken'),
          },
          mockLineUp[1] as RegisteredProvider,
          mockLineUp[2] as RegisteredProvider,
        ],
      },
    );

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.results.gemini.status).toBe('error');
    expect(body.results.gemini.scores).toBeNull();
    expect(body.results.openai.status).toBe('ok');
  });

  it('marks a provider that exceeds the timeout as errored, without failing the request', async () => {
    const response = await post(
      { url: VALID_URL },
      {
        env: { PROVIDER_TIMEOUT_MS: '30' },
        providers: [
          {
            id: 'gemini',
            label: 'Gemini',
            model: 'slow',
            status: 'ok',
            provider: new MockProvider({ name: 'gemini', model: 'slow', latencyMs: 400 }),
          },
          mockLineUp[1] as RegisteredProvider,
          mockLineUp[2] as RegisteredProvider,
        ],
      },
    );

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.results.gemini.status).toBe('error');
    expect(body.results.gemini.answers[0].error.code).toBe('PROVIDER_TIMEOUT');
    expect(body.results.openai.status).toBe('ok');
  });
});

describe('scoring end to end', () => {
  it('gives a model that answers everything correctly 100%', async () => {
    const instance = await buildTestApp({ providers: mockLineUp });
    const questions = (
      await instance.inject({ method: 'POST', url: '/api/benchmark', payload: { url: VALID_URL } })
    ).json().questions as { prompt: string; expectedAnswer: string | null }[];
    await instance.close();

    const script = Object.fromEntries(
      questions.map((q) => [q.prompt, q.expectedAnswer ?? 'NOT IN PAGE']),
    );

    const response = await post(
      { url: VALID_URL },
      {
        providers: [
          {
            id: 'claude',
            label: 'Claude',
            model: 'scripted',
            status: 'ok',
            provider: new ScriptedProvider('claude', 'scripted', script),
          },
        ],
      },
    );

    expect(response.json().results.claude.scores.overall.percentage).toBe(100);
  });

  it('gives a model that answers nonsense 0% while still grading it', async () => {
    const nonsense = {
      name: 'gemini',
      model: 'nonsense',
      answer: vi.fn().mockResolvedValue('purple monkey dishwasher'),
    };

    const response = await post(
      { url: VALID_URL },
      {
        providers: [
          { id: 'gemini', label: 'Gemini', model: 'nonsense', status: 'ok', provider: nonsense },
        ],
      },
    );

    const gemini = response.json().results.gemini;
    expect(gemini.status).toBe('ok');
    expect(gemini.scores.overall.percentage).toBe(0);
    expect(gemini.scores.overall.evaluated).toBeGreaterThan(0);
  });
});
