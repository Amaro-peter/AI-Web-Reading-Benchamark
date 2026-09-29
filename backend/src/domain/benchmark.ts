import type { ProviderId } from '../config/env.js';

/**
 * The three things this benchmark tries to tell apart.
 *
 * EXTRACTION    — is the fact on the page reported back verbatim?
 * COMPREHENSION — is a fact stated in prose understood, not just copied?
 * RELATION      — are two separate facts on the page connected correctly?
 */
export const QUESTION_CATEGORIES = ['EXTRACTION', 'COMPREHENSION', 'RELATION'] as const;
export type QuestionCategory = (typeof QUESTION_CATEGORIES)[number];

export interface Question {
  id: string;
  category: QuestionCategory;
  prompt: string;
  /**
   * The answer derived from the page, or null when the page does not contain
   * enough information to judge. A null expected answer is never invented: the
   * question is reported as NOT_EVALUABLE instead.
   */
  expectedAnswer: string | null;
  /** Additional spellings that count as correct (units, digits vs words, ...). */
  acceptableAnswers: string[];
}

export const VERDICTS = ['CORRECT', 'PARTIAL', 'INCORRECT', 'NOT_EVALUABLE'] as const;
export type Verdict = (typeof VERDICTS)[number];

/**
 * Score per verdict. NOT_EVALUABLE scores zero but is excluded from the
 * denominator, so a question we cannot judge neither rewards nor punishes.
 */
export const VERDICT_SCORES: Record<Verdict, number> = {
  CORRECT: 1,
  PARTIAL: 0.5,
  INCORRECT: 0,
  NOT_EVALUABLE: 0,
};

export function scoreForVerdict(verdict: Verdict): number {
  return VERDICT_SCORES[verdict];
}

/** Whether a verdict counts towards the score denominator. */
export function countsTowardsScore(verdict: Verdict): boolean {
  return verdict !== 'NOT_EVALUABLE';
}

export type ProviderStatus = 'ok' | 'unavailable' | 'error';

export interface ProviderInfo {
  id: ProviderId;
  /** Human-facing label, e.g. "ChatGPT". */
  label: string;
  model: string;
}
