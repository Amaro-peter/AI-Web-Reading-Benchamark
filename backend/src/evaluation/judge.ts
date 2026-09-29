import type { Question, Verdict } from '../domain/benchmark.js';
import { NOT_IN_PAGE } from '../providers/prompt.js';
import { answerTokens, containsAllTokens, normalizeAnswer, tokenOverlap } from './normalize.js';

export interface JudgeInput {
  question: Question;
  expectedAnswer: string | null;
  actualAnswer: string;
}

/**
 * The evaluation seam.
 *
 * Scoring never calls a judge implementation directly, so the rule set can be
 * replaced — including by an LLM-as-a-judge — without touching the
 * orchestrator or the API. See README "Evaluation" for why the default is not
 * an LLM.
 */
export interface Judge {
  readonly name: string;
  evaluate(input: JudgeInput): Verdict;
}

/** At or above this share of the expected tokens, an answer is PARTIAL. */
export const PARTIAL_THRESHOLD = 0.5;

/**
 * The default judge: deterministic string comparison, no model involved.
 *
 * Every question this benchmark asks has a gold answer read directly off the
 * page, so grading does not need judgement — and a deterministic judge keeps
 * results reproducible and free. An LLM judge would reintroduce exactly the
 * variance the benchmark is trying to measure.
 */
export const heuristicJudge: Judge = {
  name: 'heuristic',

  evaluate({ expectedAnswer, actualAnswer }: JudgeInput): Verdict {
    // No gold answer means the page did not support the question. Never guess.
    if (expectedAnswer === null) {
      return 'NOT_EVALUABLE';
    }

    const actual = normalizeAnswer(actualAnswer);
    if (actual.length === 0) {
      return 'INCORRECT';
    }

    const expected = normalizeAnswer(expectedAnswer);

    if (expected === actual) {
      return 'CORRECT';
    }

    // "The page does not say" is a specific claim, not a near-miss: a model
    // that abstains where an answer exists is wrong, not partially right, and
    // an answer offered where the page is silent is wrong too.
    const abstention = normalizeAnswer(NOT_IN_PAGE);
    if (expected === abstention || actual === abstention) {
      return expected === actual ? 'CORRECT' : 'INCORRECT';
    }

    // A model answering in a full sentence still gave the fact.
    if (containsAllTokens(expectedAnswer, actualAnswer)) {
      return 'CORRECT';
    }

    // Numbers are the discriminating part of a factual answer. "Route 15"
    // for "Route 28" shares half its tokens but is simply wrong, so a missing
    // or different number rules out partial credit.
    if (!everyNumberMatches(expectedAnswer, actualAnswer)) {
      return 'INCORRECT';
    }

    const overlap = tokenOverlap(expectedAnswer, actualAnswer);
    if (overlap >= PARTIAL_THRESHOLD && answerTokens(expectedAnswer).length > 1) {
      return 'PARTIAL';
    }

    return 'INCORRECT';
  },
};

function everyNumberMatches(expectedAnswer: string, actualAnswer: string): boolean {
  const expectedNumbers = answerTokens(expectedAnswer).filter(isNumeric);
  if (expectedNumbers.length === 0) {
    return true;
  }

  const actual = new Set(answerTokens(actualAnswer));
  return expectedNumbers.every((number) => actual.has(number));
}

function isNumeric(token: string): boolean {
  return /^\d+$/.test(token);
}

/**
 * Applies a judge to a question, trying every accepted spelling of the gold
 * answer and keeping the best verdict.
 */
export function evaluateAnswer(judge: Judge, question: Question, actualAnswer: string): Verdict {
  const candidates = [question.expectedAnswer, ...question.acceptableAnswers];

  let best: Verdict = 'NOT_EVALUABLE';

  for (const expectedAnswer of candidates) {
    const verdict = judge.evaluate({ question, expectedAnswer, actualAnswer });
    if (verdict === 'CORRECT') {
      return 'CORRECT';
    }
    best = betterVerdict(best, verdict);
  }

  return best;
}

const VERDICT_RANK: Record<Verdict, number> = {
  NOT_EVALUABLE: 0,
  INCORRECT: 1,
  PARTIAL: 2,
  CORRECT: 3,
};

function betterVerdict(a: Verdict, b: Verdict): Verdict {
  return VERDICT_RANK[b] > VERDICT_RANK[a] ? b : a;
}
