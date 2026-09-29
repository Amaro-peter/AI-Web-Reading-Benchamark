import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { MockProvider, ScriptedProvider } from '../../src/providers/mock.js';
import type { RegisteredProvider } from '../../src/providers/types.js';
import { buildTestApp, VALID_URL } from '../helpers/app.js';

/**
 * Regression baseline for the wire format and for the score the fixture
 * produces. If either changes, a client integration changes with it.
 */

let app: FastifyInstance | null = null;

afterEach(async () => {
  await app?.close();
  app = null;
});

async function run(providers: RegisteredProvider[]) {
  const instance = await buildTestApp({ providers });
  app = instance;
  const response = await instance.inject({
    method: 'POST',
    url: '/api/benchmark',
    payload: { url: VALID_URL },
  });
  return response.json();
}

function mock(
  id: 'gemini' | 'openai' | 'claude',
  strategy?: 'sentence' | 'clause' | 'abstain',
): RegisteredProvider {
  return {
    id,
    label: id,
    model: `mock-${id}`,
    status: 'ok',
    provider: new MockProvider({
      name: id,
      model: `mock-${id}`,
      ...(strategy === undefined ? {} : { strategy }),
    }),
  };
}

describe('regression: response shape', () => {
  it('has exactly the documented top-level keys', async () => {
    const body = await run([mock('gemini')]);

    expect(Object.keys(body).sort()).toEqual([
      'disclaimer',
      'durationMs',
      'finalUrl',
      'generatedAt',
      'judge',
      'page',
      'questions',
      'results',
      'url',
    ]);
  });

  it('has a stable page object', async () => {
    const body = await run([mock('gemini')]);

    expect(Object.keys(body.page).sort()).toEqual([
      'byline',
      'charCount',
      'extractionStrategy',
      'headings',
      'lang',
      'publishedTime',
      'siteName',
      'title',
      'truncated',
      'wordCount',
    ]);
    expect(body.page).toMatchObject({
      title: "Lisbon's tram network turns 150",
      wordCount: 428,
      byline: 'Marta Ribeiro',
      siteName: 'The Transit Review',
      lang: 'en',
      extractionStrategy: 'readability',
      truncated: false,
    });
  });

  it('has a stable question object', async () => {
    const body = await run([mock('gemini')]);

    for (const question of body.questions) {
      expect(Object.keys(question).sort()).toEqual([
        'acceptableAnswers',
        'category',
        'expectedAnswer',
        'id',
        'prompt',
      ]);
    }
  });

  it('has a stable provider result object', async () => {
    const body = await run([mock('gemini')]);

    expect(Object.keys(body.results.gemini).sort()).toEqual([
      'answers',
      'durationMs',
      'id',
      'label',
      'model',
      'reason',
      'scores',
      'status',
    ]);
    expect(Object.keys(body.results.gemini.answers[0]).sort()).toEqual([
      'answer',
      'durationMs',
      'error',
      'questionId',
      'score',
      'verdict',
    ]);
    expect(Object.keys(body.results.gemini.scores.overall).sort()).toEqual([
      'correct',
      'evaluated',
      'incorrect',
      'notEvaluable',
      'partial',
      'percentage',
      'score',
    ]);
  });

  it('always reports all three categories in the breakdown', async () => {
    const body = await run([mock('gemini')]);
    expect(Object.keys(body.results.gemini.scores.byCategory).sort()).toEqual([
      'COMPREHENSION',
      'EXTRACTION',
      'RELATION',
    ]);
  });
});

describe('regression: scoring the fixture', () => {
  it('scores the sentence-matching mock identically on every run', async () => {
    const first = await run([mock('gemini')]);
    await app?.close();
    app = null;
    const second = await run([mock('gemini')]);

    expect(second.results.gemini.scores).toEqual(first.results.gemini.scores);
    expect(second.results.gemini.answers.map((a: { answer: string }) => a.answer)).toEqual(
      first.results.gemini.answers.map((a: { answer: string }) => a.answer),
    );
  });

  it('scores a perfect answerer at 100% in every category', async () => {
    const probe = await run([mock('gemini')]);
    await app?.close();
    app = null;

    const script = Object.fromEntries(
      (probe.questions as { prompt: string; expectedAnswer: string }[]).map((q) => [
        q.prompt,
        q.expectedAnswer,
      ]),
    );

    const body = await run([
      {
        id: 'claude',
        label: 'Claude',
        model: 'scripted',
        status: 'ok',
        provider: new ScriptedProvider('claude', 'scripted', script),
      },
    ]);

    const scores = body.results.claude.scores;
    expect(scores.overall).toMatchObject({ correct: 5, evaluated: 5, score: 5, percentage: 100 });
    expect(scores.byCategory.EXTRACTION.percentage).toBe(100);
    expect(scores.byCategory.COMPREHENSION.percentage).toBe(100);
    expect(scores.byCategory.RELATION.percentage).toBe(100);
  });

  it('scores an always-abstaining model at 0% without marking it unevaluable', async () => {
    const body = await run([mock('claude', 'abstain')]);

    const scores = body.results.claude.scores;
    expect(scores.overall.evaluated).toBe(5);
    expect(scores.overall.percentage).toBe(0);
    expect(scores.overall.notEvaluable).toBe(0);
  });
});
