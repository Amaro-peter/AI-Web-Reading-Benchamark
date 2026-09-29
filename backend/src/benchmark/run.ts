import { BENCHMARK_DISCLAIMER } from '../app-info.js';
import type { ProviderId } from '../config/env.js';
import type { ProviderStatus, Question, Verdict } from '../domain/benchmark.js';
import { scoreForVerdict } from '../domain/benchmark.js';
import { evaluateAnswer, heuristicJudge, type Judge } from '../evaluation/judge.js';
import { summarizeScores, type ScoreSummary } from '../evaluation/score.js';
import { ProviderError, type AIProvider, type RegisteredProvider } from '../providers/types.js';
import type { ScrapedPage } from '../scraper/index.js';
import { buildQuestions } from './questions.js';

interface AnswerRecord {
  questionId: string;
  /** The raw model answer, or null when the call failed. */
  answer: string | null;
  error: { code: string; message: string } | null;
  verdict: Verdict;
  score: number;
  durationMs: number;
}

interface ProviderRunResult {
  id: ProviderId;
  label: string;
  model: string;
  status: ProviderStatus;
  /** Present when the provider is unavailable or every call failed. */
  reason: string | null;
  answers: AnswerRecord[];
  /** Null when the provider never answered, so no score can be claimed. */
  scores: ScoreSummary | null;
  durationMs: number;
}

interface BenchmarkRun {
  url: string;
  finalUrl: string;
  page: {
    title: string;
    wordCount: number;
    charCount: number;
    truncated: boolean;
    byline: string | null;
    siteName: string | null;
    publishedTime: string | null;
    lang: string | null;
    headings: string[];
    extractionStrategy: string;
  };
  questions: Question[];
  results: Record<ProviderId, ProviderRunResult>;
  judge: string;
  disclaimer: string;
  generatedAt: string;
  durationMs: number;
}

interface RunBenchmarkOptions {
  page: ScrapedPage;
  providers: RegisteredProvider[];
  /** Hard ceiling per model call, independent of any SDK-level timeout. */
  timeoutMs: number;
  judge?: Judge;
  /** Injectable clock, so tests are not timing-dependent. */
  now?: () => number;
}

/**
 * Runs the benchmark.
 *
 * Every provider is asked every question, all in parallel: a slow model must
 * not add its latency to the others'. One provider failing — missing key,
 * refusal, timeout, transport error — never stops the rest; it is recorded
 * and the run completes.
 */
export async function runBenchmark(options: RunBenchmarkOptions): Promise<BenchmarkRun> {
  const { page, providers, timeoutMs } = options;
  const judge = options.judge ?? heuristicJudge;
  const now = options.now ?? Date.now;

  const startedAt = now();
  const questions = buildQuestions(page);

  const results = await Promise.all(
    providers.map((entry) => runProvider(entry, page, questions, judge, timeoutMs, now)),
  );

  return {
    url: page.requestedUrl,
    finalUrl: page.finalUrl,
    page: {
      title: page.title,
      wordCount: page.wordCount,
      charCount: page.charCount,
      truncated: page.truncated,
      byline: page.byline,
      siteName: page.siteName,
      publishedTime: page.publishedTime,
      lang: page.lang,
      headings: page.headings,
      extractionStrategy: page.strategy,
    },
    questions,
    results: Object.fromEntries(results.map((result) => [result.id, result])) as Record<
      ProviderId,
      ProviderRunResult
    >,
    judge: judge.name,
    disclaimer: BENCHMARK_DISCLAIMER,
    generatedAt: new Date(startedAt).toISOString(),
    durationMs: now() - startedAt,
  };
}

async function runProvider(
  entry: RegisteredProvider,
  page: ScrapedPage,
  questions: Question[],
  judge: Judge,
  timeoutMs: number,
  now: () => number,
): Promise<ProviderRunResult> {
  const base = { id: entry.id, label: entry.label, model: entry.model };

  if (entry.status === 'unavailable') {
    return {
      ...base,
      status: 'unavailable',
      reason: entry.reason,
      answers: [],
      scores: null,
      durationMs: 0,
    };
  }

  const startedAt = now();

  const answers = await Promise.all(
    questions.map((question) => askOne(entry.provider, page, question, judge, timeoutMs, now)),
  );

  const everyCallFailed = answers.every((answer) => answer.error !== null);

  return {
    ...base,
    status: everyCallFailed ? 'error' : 'ok',
    reason: everyCallFailed ? (answers[0]?.error?.message ?? 'Every request failed.') : null,
    answers,
    // A provider that answered nothing gets no score — zero would read as
    // "answered everything wrong", which is a different claim.
    scores: everyCallFailed
      ? null
      : summarizeScores(
          answers.map((answer, index) => ({
            category: questions[index]?.category ?? 'EXTRACTION',
            verdict: answer.verdict,
          })),
        ),
    durationMs: now() - startedAt,
  };
}

async function askOne(
  provider: AIProvider,
  page: ScrapedPage,
  question: Question,
  judge: Judge,
  timeoutMs: number,
  now: () => number,
): Promise<AnswerRecord> {
  const startedAt = now();

  try {
    const answer = await withTimeout(
      provider.answer({ pageContent: page.text, question: question.prompt }),
      timeoutMs,
      provider.name,
    );

    const verdict = evaluateAnswer(judge, question, answer);

    return {
      questionId: question.id,
      answer,
      error: null,
      verdict,
      score: scoreForVerdict(verdict),
      durationMs: now() - startedAt,
    };
  } catch (error) {
    const providerError = ProviderError.fromUnknown(provider.name, error);

    return {
      questionId: question.id,
      answer: null,
      error: { code: providerError.code, message: providerError.message },
      // A call that never returned tells us nothing about the model's reading,
      // so it is excluded from the score rather than counted as wrong.
      verdict: 'NOT_EVALUABLE',
      score: 0,
      durationMs: now() - startedAt,
    };
  }
}

/** Caps a provider call regardless of what the vendor SDK does about timeouts. */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, name: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new ProviderError('PROVIDER_TIMEOUT', `${name} did not answer in time.`));
    }, timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}
