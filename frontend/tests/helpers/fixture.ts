import type { BenchmarkResult, ProviderResult, ScoreSummary } from '@/lib/types';

function scores(overall: number): ScoreSummary {
  const breakdown = {
    correct: 2,
    partial: 1,
    incorrect: 1,
    notEvaluable: 1,
    evaluated: 4,
    score: 2.5,
    percentage: overall,
  };
  return {
    overall: breakdown,
    byCategory: {
      EXTRACTION: { ...breakdown, percentage: 100 },
      COMPREHENSION: { ...breakdown, percentage: 50 },
      RELATION: { ...breakdown, evaluated: 0, score: 0, percentage: null },
    },
  };
}

function provider(
  overrides: Partial<ProviderResult> & Pick<ProviderResult, 'id' | 'label'>,
): ProviderResult {
  return {
    model: 'test-model',
    status: 'ok',
    reason: null,
    durationMs: 1200,
    scores: scores(62.5),
    answers: [
      {
        questionId: 'q1-title',
        answer: "Lisbon's tram network turns 150",
        error: null,
        verdict: 'CORRECT',
        score: 1,
        durationMs: 300,
      },
      {
        questionId: 'q2-author',
        answer: 'Marta',
        error: null,
        verdict: 'PARTIAL',
        score: 0.5,
        durationMs: 300,
      },
      {
        questionId: 'q3-first-heading',
        answer: 'Something else',
        error: null,
        verdict: 'INCORRECT',
        score: 0,
        durationMs: 300,
      },
      {
        questionId: 'q4-cloze',
        answer: '1873',
        error: null,
        verdict: 'CORRECT',
        score: 1,
        durationMs: 300,
      },
      {
        questionId: 'q5-section-of-term',
        answer: null,
        error: { code: 'PROVIDER_TIMEOUT', message: 'Gemini did not answer in time.' },
        verdict: 'NOT_EVALUABLE',
        score: 0,
        durationMs: 300,
      },
    ],
    ...overrides,
  };
}

/** A complete, realistic benchmark result for component tests. */
export function benchmarkResultFixture(overrides: Partial<BenchmarkResult> = {}): BenchmarkResult {
  return {
    url: 'https://fixtures.test/article',
    finalUrl: 'https://fixtures.test/article',
    page: {
      title: "Lisbon's tram network turns 150",
      wordCount: 428,
      charCount: 2600,
      truncated: false,
      byline: 'Marta Ribeiro',
      siteName: 'The Transit Review',
      publishedTime: '2024-03-12T08:00:00Z',
      lang: 'en',
      headings: ['A network built for hills'],
      extractionStrategy: 'readability',
    },
    questions: [
      {
        id: 'q1-title',
        category: 'EXTRACTION',
        prompt: 'What is the title of this page?',
        expectedAnswer: "Lisbon's tram network turns 150",
        acceptableAnswers: [],
      },
      {
        id: 'q2-author',
        category: 'EXTRACTION',
        prompt: 'Who wrote this page?',
        expectedAnswer: 'Marta Ribeiro',
        acceptableAnswers: [],
      },
      {
        id: 'q3-first-heading',
        category: 'EXTRACTION',
        prompt: 'What is the first section heading?',
        expectedAnswer: 'A network built for hills',
        acceptableAnswers: [],
      },
      {
        id: 'q4-cloze',
        category: 'COMPREHENSION',
        prompt: 'What value belongs in the blank?',
        expectedAnswer: '1873',
        acceptableAnswers: [],
      },
      {
        id: 'q5-section-of-term',
        category: 'RELATION',
        prompt: 'Which section discusses the term?',
        expectedAnswer: null,
        acceptableAnswers: [],
      },
    ],
    results: {
      gemini: provider({ id: 'gemini', label: 'Gemini' }),
      openai: provider({ id: 'openai', label: 'ChatGPT' }),
      claude: provider({
        id: 'claude',
        label: 'Claude',
        status: 'unavailable',
        reason: 'ANTHROPIC_API_KEY is not configured.',
        answers: [],
        scores: null,
        durationMs: 0,
      }),
    },
    judge: 'heuristic',
    disclaimer:
      'Experimental benchmark. Results depend on the page, the questions, the models and the evaluation method, and must not be read as a definitive model ranking.',
    generatedAt: '2024-03-12T08:00:00.000Z',
    durationMs: 1400,
    ...overrides,
  };
}
