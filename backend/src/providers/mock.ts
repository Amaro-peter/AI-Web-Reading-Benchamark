import { normalizeWhitespace } from '../domain/text.js';
import { NOT_IN_PAGE } from './prompt.js';
import { type AIProvider, type AnswerInput, ProviderError } from './types.js';

/**
 * Deterministic in-process providers.
 *
 * Every test and the whole E2E suite run against these, so no suite can reach
 * a paid API by accident. They are also what `AI_PROVIDER_MODE=mock` serves,
 * which is how the app can be demonstrated with no credentials at all.
 */

const STOP_WORDS = new Set([
  'the',
  'a',
  'an',
  'of',
  'in',
  'on',
  'at',
  'to',
  'for',
  'and',
  'or',
  'is',
  'are',
  'was',
  'were',
  'what',
  'which',
  'who',
  'whom',
  'when',
  'where',
  'why',
  'how',
  'does',
  'do',
  'did',
  'this',
  'that',
  'these',
  'those',
  'according',
  'page',
  'article',
  'many',
  'much',
  'it',
  'its',
  'as',
  'by',
  'with',
  'from',
  'about',
]);

function contentWords(value: string): string[] {
  return normalizeWhitespace(value.toLowerCase())
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));
}

function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => normalizeWhitespace(sentence))
    .filter((sentence) => sentence.length > 0);
}

/**
 * Returns the page sentence sharing the most content words with the question.
 * A crude reading strategy, but a real one — which makes mock results look
 * like plausible benchmark output instead of a fixed string.
 */
export function bestMatchingSentence(pageContent: string, question: string): string | null {
  const wanted = new Set(contentWords(question));
  if (wanted.size === 0) {
    return null;
  }

  let best: { sentence: string; score: number } | null = null;

  for (const sentence of sentences(pageContent)) {
    const words = new Set(contentWords(sentence));
    let overlap = 0;
    for (const word of wanted) {
      if (words.has(word)) {
        overlap += 1;
      }
    }
    if (overlap > 0 && (best === null || overlap > best.score)) {
      best = { sentence, score: overlap };
    }
  }

  return best?.sentence ?? null;
}

type MockStrategy =
  /** Answers with the most relevant sentence from the page. */
  | 'sentence'
  /** Answers with only the first clause of it — often partially right. */
  | 'clause'
  /** Always says the page does not answer the question. */
  | 'abstain';

interface MockProviderOptions {
  name: string;
  model: string;
  strategy?: MockStrategy;
  /** Simulated latency, used by timeout tests. */
  latencyMs?: number;
}

export class MockProvider implements AIProvider {
  readonly name: string;
  readonly model: string;

  private readonly strategy: MockStrategy;
  private readonly latencyMs: number;

  constructor(options: MockProviderOptions) {
    this.name = options.name;
    this.model = options.model;
    this.strategy = options.strategy ?? 'sentence';
    this.latencyMs = options.latencyMs ?? 0;
  }

  async answer(input: AnswerInput): Promise<string> {
    if (this.latencyMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.latencyMs));
    }

    if (this.strategy === 'abstain') {
      return NOT_IN_PAGE;
    }

    const sentence = bestMatchingSentence(input.pageContent, input.question);
    if (sentence === null) {
      return NOT_IN_PAGE;
    }

    if (this.strategy === 'clause') {
      return normalizeWhitespace(sentence.split(/[,;:]/)[0] ?? sentence);
    }

    return sentence;
  }
}

/**
 * Answers from a fixed script, so a test can state exactly what a model said.
 * Lookup is by question text; an unscripted question abstains.
 */
export class ScriptedProvider implements AIProvider {
  readonly name: string;
  readonly model: string;

  private readonly answers: ReadonlyMap<string, string>;

  constructor(name: string, model: string, answers: Record<string, string>) {
    this.name = name;
    this.model = model;
    this.answers = new Map(Object.entries(answers));
  }

  async answer(input: AnswerInput): Promise<string> {
    return this.answers.get(input.question) ?? NOT_IN_PAGE;
  }
}

/** Always fails, for the "provider returns an error" path. */
export class FailingProvider implements AIProvider {
  readonly name: string;
  readonly model: string;

  private readonly error: ProviderError;

  constructor(name: string, model: string, error?: ProviderError) {
    this.name = name;
    this.model = model;
    this.error = error ?? new ProviderError('PROVIDER_ERROR', `${name} request failed.`);
  }

  async answer(): Promise<string> {
    throw this.error;
  }
}
