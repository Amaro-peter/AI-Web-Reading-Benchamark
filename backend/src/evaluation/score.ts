import {
  countsTowardsScore,
  QUESTION_CATEGORIES,
  scoreForVerdict,
  type QuestionCategory,
  type Verdict,
} from '../domain/benchmark.js';

export interface ScoreBreakdown {
  correct: number;
  partial: number;
  incorrect: number;
  notEvaluable: number;
  /** Questions that could be graded — the denominator. */
  evaluated: number;
  /** Sum of verdict scores: CORRECT 1, PARTIAL 0.5, INCORRECT 0. */
  score: number;
  /**
   * score / evaluated, as a percentage — or null when nothing could be
   * graded. Null is not zero: "we could not measure this" and "it got
   * everything wrong" are different results and must not look alike.
   */
  percentage: number | null;
}

export interface ScoreSummary {
  overall: ScoreBreakdown;
  byCategory: Record<QuestionCategory, ScoreBreakdown>;
}

export interface GradedItem {
  category: QuestionCategory;
  verdict: Verdict;
}

function emptyBreakdown(): ScoreBreakdown {
  return {
    correct: 0,
    partial: 0,
    incorrect: 0,
    notEvaluable: 0,
    evaluated: 0,
    score: 0,
    percentage: null,
  };
}

function tally(items: GradedItem[]): ScoreBreakdown {
  const breakdown = emptyBreakdown();

  for (const { verdict } of items) {
    switch (verdict) {
      case 'CORRECT':
        breakdown.correct += 1;
        break;
      case 'PARTIAL':
        breakdown.partial += 1;
        break;
      case 'INCORRECT':
        breakdown.incorrect += 1;
        break;
      case 'NOT_EVALUABLE':
        breakdown.notEvaluable += 1;
        break;
    }

    if (countsTowardsScore(verdict)) {
      breakdown.evaluated += 1;
      breakdown.score += scoreForVerdict(verdict);
    }
  }

  breakdown.score = round(breakdown.score);
  breakdown.percentage =
    breakdown.evaluated === 0 ? null : round((breakdown.score / breakdown.evaluated) * 100);

  return breakdown;
}

/** Aggregates verdicts overall and per category. */
export function summarizeScores(items: GradedItem[]): ScoreSummary {
  const byCategory = Object.fromEntries(
    QUESTION_CATEGORIES.map((category) => [
      category,
      tally(items.filter((item) => item.category === category)),
    ]),
  ) as Record<QuestionCategory, ScoreBreakdown>;

  return { overall: tally(items), byCategory };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
