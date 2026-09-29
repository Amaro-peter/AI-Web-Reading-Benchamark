import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { FailingProvider, MockProvider } from '../../src/providers/mock.js';
import type { AIProvider, RegisteredProvider } from '../../src/providers/types.js';
import { buildTestApp, VALID_URL } from '../helpers/app.js';

/**
 * Executable specification.
 *
 * Each test here states one product requirement in the language of the
 * requirement, not of the implementation. These are the statements that must
 * remain true no matter how the internals are rearranged.
 *
 * Written with plain Vitest rather than Cucumber: a Gherkin layer would add a
 * parser, a step registry and a second vocabulary without making any of these
 * statements clearer.
 */

let app: FastifyInstance | null = null;

afterEach(async () => {
  await app?.close();
  app = null;
});

function provider(id: 'gemini' | 'openai' | 'claude', impl?: AIProvider): RegisteredProvider {
  return {
    id,
    label: id,
    model: `mock-${id}`,
    status: 'ok',
    provider: impl ?? new MockProvider({ name: id, model: `mock-${id}` }),
  };
}

function missing(id: 'gemini' | 'openai' | 'claude', reason: string): RegisteredProvider {
  return { id, label: id, model: `mock-${id}`, status: 'unavailable', reason };
}

const allThree = [provider('gemini'), provider('openai'), provider('claude')];

async function benchmark(url: string, providers = allThree) {
  const instance = await buildTestApp({ providers });
  app = instance;
  return instance.inject({ method: 'POST', url: '/api/benchmark', payload: { url } });
}

describe('SPEC: the user submits a URL', () => {
  it('a valid URL is accepted', async () => {
    const response = await benchmark(VALID_URL);
    expect(response.statusCode).toBe(200);
  });

  it('an invalid URL is rejected with an explanation, not a crash', async () => {
    const response = await benchmark('not a url');
    expect(response.statusCode).toBe(400);
    expect(response.json().error.message).toBeTruthy();
  });

  it('a URL the service must not fetch is refused', async () => {
    const response = await benchmark('http://127.0.0.1:8080/');
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('BLOCKED_HOST');
  });
});

describe('SPEC: the system extracts the page', () => {
  it('the response reports the page title and its length in words', async () => {
    const body = (await benchmark(VALID_URL)).json();
    expect(body.page.title).toBeTruthy();
    expect(body.page.wordCount).toBeGreaterThan(0);
  });

  it('the response reports which URL the content actually came from', async () => {
    const body = (await benchmark(VALID_URL)).json();
    expect(body.url).toBe(VALID_URL);
    expect(body.finalUrl).toBeTruthy();
  });
});

describe('SPEC: the system runs a benchmark', () => {
  it('it asks about five questions', async () => {
    const body = (await benchmark(VALID_URL)).json();
    expect(body.questions.length).toBeGreaterThanOrEqual(4);
    expect(body.questions.length).toBeLessThanOrEqual(6);
  });

  it('it covers extraction, comprehension and relation', async () => {
    const body = (await benchmark(VALID_URL)).json();
    const categories = new Set(body.questions.map((q: { category: string }) => q.category));
    expect([...categories].sort()).toEqual(['COMPREHENSION', 'EXTRACTION', 'RELATION']);
  });

  it('every question is asked of every available provider', async () => {
    const body = (await benchmark(VALID_URL)).json();
    for (const id of ['gemini', 'openai', 'claude']) {
      expect(body.results[id].answers).toHaveLength(body.questions.length);
    }
  });
});

describe('SPEC: three providers can answer', () => {
  it('Gemini, ChatGPT and Claude each get a result', async () => {
    const body = (await benchmark(VALID_URL)).json();
    expect(Object.keys(body.results).sort()).toEqual(['claude', 'gemini', 'openai']);
  });

  it('each result names the model that produced it', async () => {
    const body = (await benchmark(VALID_URL)).json();
    for (const id of ['gemini', 'openai', 'claude']) {
      expect(body.results[id].model).toBeTruthy();
    }
  });
});

describe('SPEC: an unavailable provider does not break the benchmark', () => {
  it('the run still succeeds when a provider has no credential', async () => {
    const response = await benchmark(VALID_URL, [
      missing('gemini', 'GEMINI_API_KEY is not configured.'),
      provider('openai'),
      provider('claude'),
    ]);

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.results.gemini.status).toBe('unavailable');
    expect(body.results.openai.answers.length).toBeGreaterThan(0);
    expect(body.results.claude.answers.length).toBeGreaterThan(0);
  });

  it('the run still succeeds when a provider fails outright', async () => {
    const response = await benchmark(VALID_URL, [
      provider('gemini', new FailingProvider('gemini', 'mock-gemini')),
      provider('openai'),
      provider('claude'),
    ]);

    expect(response.statusCode).toBe(200);
    expect(response.json().results.gemini.status).toBe('error');
    expect(response.json().results.openai.status).toBe('ok');
  });

  it('an unavailable provider is never given a score', async () => {
    const body = (await benchmark(VALID_URL, [missing('gemini', 'no key')])).json();

    expect(body.results.gemini.scores).toBeNull();
  });
});

describe('SPEC: the result is presented in full', () => {
  it('individual answers are returned, not only the totals', async () => {
    const body = (await benchmark(VALID_URL)).json();
    for (const answer of body.results.gemini.answers) {
      expect(answer).toHaveProperty('answer');
      expect(answer).toHaveProperty('verdict');
    }
  });

  it('the score is broken down per category as well as overall', async () => {
    const body = (await benchmark(VALID_URL)).json();
    expect(body.results.gemini.scores.overall).toBeDefined();
    expect(body.results.gemini.scores.byCategory.EXTRACTION).toBeDefined();
  });

  it('the gold answers are returned so a reader can check the grading', async () => {
    const body = (await benchmark(VALID_URL)).json();
    expect(body.questions.some((q: { expectedAnswer: unknown }) => q.expectedAnswer !== null)).toBe(
      true,
    );
  });

  it('the result states that the benchmark is experimental', async () => {
    const body = (await benchmark(VALID_URL)).json();
    expect(body.disclaimer).toContain('Experimental');
    for (const factor of ['page', 'questions', 'models', 'evaluation method']) {
      expect(body.disclaimer).toContain(factor);
    }
  });

  it('the result names the evaluation method used', async () => {
    const body = (await benchmark(VALID_URL)).json();
    expect(body.judge).toBeTruthy();
  });

  it('the result never ranks the models for the reader', async () => {
    const body = (await benchmark(VALID_URL)).json();
    // The disclaimer is allowed to use the word "ranking" — it is there to
    // say the result is not one.
    const { disclaimer, ...rest } = body;
    expect(disclaimer).toContain('not be read as a definitive model ranking');

    const serialized = JSON.stringify(rest).toLowerCase();
    for (const editorial of ['winner', 'best model', 'worst', 'rank', 'recommend']) {
      expect(serialized).not.toContain(editorial);
    }
  });
});
