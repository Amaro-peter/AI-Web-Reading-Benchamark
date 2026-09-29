import { beforeAll, describe, expect, it } from 'vitest';
import { runBenchmark } from '../../src/benchmark/run.js';
import { buildQuestions } from '../../src/benchmark/questions.js';
import { FailingProvider, MockProvider, ScriptedProvider } from '../../src/providers/mock.js';
import {
  ProviderError,
  type AIProvider,
  type RegisteredProvider,
} from '../../src/providers/types.js';
import type { ScrapedPage } from '../../src/scraper/index.js';
import { scrapeFixture } from '../helpers/page.js';

let page: ScrapedPage;

beforeAll(async () => {
  page = await scrapeFixture('article');
});

function available(id: 'gemini' | 'openai' | 'claude', provider: AIProvider): RegisteredProvider {
  return { id, label: id, model: provider.model, status: 'ok', provider };
}

function unavailable(id: 'gemini' | 'openai' | 'claude', reason: string): RegisteredProvider {
  return { id, label: id, model: 'none', status: 'unavailable', reason };
}

/** A provider that answers every question with its gold answer. */
function perfectProvider(name: 'gemini' | 'openai' | 'claude', p: ScrapedPage): AIProvider {
  const answers = Object.fromEntries(
    buildQuestions(p).map((q) => [q.prompt, q.expectedAnswer ?? 'NOT IN PAGE']),
  );
  return new ScriptedProvider(name, 'scripted-perfect', answers);
}

const options = { timeoutMs: 1000 };

describe('runBenchmark', () => {
  it('returns one result per provider, keyed by provider id', async () => {
    const run = await runBenchmark({
      ...options,
      page,
      providers: [
        available('gemini', new MockProvider({ name: 'gemini', model: 'm' })),
        available('openai', new MockProvider({ name: 'openai', model: 'm' })),
        available('claude', new MockProvider({ name: 'claude', model: 'm' })),
      ],
    });

    expect(Object.keys(run.results).sort()).toEqual(['claude', 'gemini', 'openai']);
  });

  it('asks every provider every question', async () => {
    const run = await runBenchmark({
      ...options,
      page,
      providers: [available('gemini', new MockProvider({ name: 'gemini', model: 'm' }))],
    });

    expect(run.results.gemini.answers).toHaveLength(run.questions.length);
    expect(run.results.gemini.answers.map((a) => a.questionId)).toEqual(
      run.questions.map((q) => q.id),
    );
  });

  it('scores a provider that answers everything correctly at 100%', async () => {
    const run = await runBenchmark({
      ...options,
      page,
      providers: [available('claude', perfectProvider('claude', page))],
    });

    expect(run.results.claude.status).toBe('ok');
    expect(run.results.claude.scores?.overall.percentage).toBe(100);
  });

  it('runs providers in parallel rather than one after another', async () => {
    const slow = (name: 'gemini' | 'openai' | 'claude') =>
      available(name, new MockProvider({ name, model: 'm', latencyMs: 60 }));

    const started = Date.now();
    await runBenchmark({
      ...options,
      timeoutMs: 5000,
      page,
      providers: [slow('gemini'), slow('openai'), slow('claude')],
    });
    const elapsed = Date.now() - started;

    // Sequential would be at least 3 providers x 5 questions x 60ms = 900ms.
    expect(elapsed).toBeLessThan(600);
  });
});

describe('a provider that cannot run', () => {
  it('is reported as unavailable with its reason and no score', async () => {
    const run = await runBenchmark({
      ...options,
      page,
      providers: [unavailable('openai', 'OPENAI_API_KEY is not configured.')],
    });

    expect(run.results.openai).toMatchObject({
      status: 'unavailable',
      reason: 'OPENAI_API_KEY is not configured.',
      answers: [],
      scores: null,
    });
  });

  it('does not stop the other providers from running', async () => {
    const run = await runBenchmark({
      ...options,
      page,
      providers: [
        unavailable('gemini', 'GEMINI_API_KEY is not configured.'),
        available('claude', perfectProvider('claude', page)),
      ],
    });

    expect(run.results.gemini.status).toBe('unavailable');
    expect(run.results.claude.scores?.overall.percentage).toBe(100);
  });
});

describe('a provider that errors', () => {
  it('is reported as error with no score when every call fails', async () => {
    const run = await runBenchmark({
      ...options,
      page,
      providers: [available('openai', new FailingProvider('openai', 'broken'))],
    });

    expect(run.results.openai.status).toBe('error');
    expect(run.results.openai.scores).toBeNull();
    expect(run.results.openai.answers.every((a) => a.error?.code === 'PROVIDER_ERROR')).toBe(true);
  });

  it('records a failed call as not evaluable, not as a wrong answer', async () => {
    const run = await runBenchmark({
      ...options,
      page,
      providers: [available('openai', new FailingProvider('openai', 'broken'))],
    });

    expect(run.results.openai.answers.every((a) => a.verdict === 'NOT_EVALUABLE')).toBe(true);
  });

  it('keeps a partially working provider on "ok" and scores what it did answer', async () => {
    let calls = 0;
    const flaky: AIProvider = {
      name: 'gemini',
      model: 'flaky',
      answer: async ({ question }) => {
        calls += 1;
        if (calls > 1) {
          throw new ProviderError('PROVIDER_ERROR', 'gemini request failed.');
        }
        return buildQuestions(page).find((q) => q.prompt === question)?.expectedAnswer ?? '';
      },
    };

    const run = await runBenchmark({ ...options, page, providers: [available('gemini', flaky)] });

    expect(run.results.gemini.status).toBe('ok');
    expect(run.results.gemini.scores).not.toBeNull();
  });

  it('does not let one provider error affect another provider score', async () => {
    const run = await runBenchmark({
      ...options,
      page,
      providers: [
        available('openai', new FailingProvider('openai', 'broken')),
        available('claude', perfectProvider('claude', page)),
      ],
    });

    expect(run.results.openai.status).toBe('error');
    expect(run.results.claude.scores?.overall.percentage).toBe(100);
  });
});

describe('timeouts', () => {
  it('cuts off a provider that exceeds the budget', async () => {
    const run = await runBenchmark({
      page,
      timeoutMs: 20,
      providers: [
        available('gemini', new MockProvider({ name: 'gemini', model: 'm', latencyMs: 500 })),
      ],
    });

    expect(run.results.gemini.status).toBe('error');
    expect(run.results.gemini.answers[0]?.error?.code).toBe('PROVIDER_TIMEOUT');
  });

  it('does not let one slow provider prevent another from being scored', async () => {
    const run = await runBenchmark({
      page,
      timeoutMs: 40,
      providers: [
        available('gemini', new MockProvider({ name: 'gemini', model: 'm', latencyMs: 400 })),
        available('claude', perfectProvider('claude', page)),
      ],
    });

    expect(run.results.gemini.status).toBe('error');
    expect(run.results.claude.scores?.overall.percentage).toBe(100);
  });
});

describe('the run envelope', () => {
  it('reports the page facts and carries the disclaimer', async () => {
    const run = await runBenchmark({
      ...options,
      page,
      providers: [available('gemini', new MockProvider({ name: 'gemini', model: 'm' }))],
    });

    expect(run.url).toBe(page.requestedUrl);
    expect(run.page.title).toBe("Lisbon's tram network turns 150");
    expect(run.page.wordCount).toBe(page.wordCount);
    expect(run.disclaimer).toContain('Experimental');
    expect(run.judge).toBe('heuristic');
    expect(run.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('names the judge that produced the verdicts', async () => {
    const run = await runBenchmark({
      ...options,
      page,
      judge: { name: 'always-correct', evaluate: () => 'CORRECT' },
      providers: [available('gemini', new MockProvider({ name: 'gemini', model: 'm' }))],
    });

    expect(run.judge).toBe('always-correct');
    expect(run.results.gemini.scores?.overall.percentage).toBe(100);
  });
});
