import { describe, expect, it } from 'vitest';
import {
  countsTowardsScore,
  scoreForVerdict,
  VERDICT_SCORES,
  VERDICTS,
} from '../../src/domain/benchmark.js';
import { summarizeScores, type GradedItem } from '../../src/evaluation/score.js';

describe('verdict scores', () => {
  it.each([
    ['CORRECT', 1],
    ['PARTIAL', 0.5],
    ['INCORRECT', 0],
    ['NOT_EVALUABLE', 0],
  ] as const)('%s scores %d', (verdict, expected) => {
    expect(scoreForVerdict(verdict)).toBe(expected);
  });

  it('defines a score for every verdict', () => {
    for (const verdict of VERDICTS) {
      expect(VERDICT_SCORES[verdict]).toBeTypeOf('number');
    }
  });

  it('excludes only NOT_EVALUABLE from the denominator', () => {
    expect(countsTowardsScore('CORRECT')).toBe(true);
    expect(countsTowardsScore('PARTIAL')).toBe(true);
    expect(countsTowardsScore('INCORRECT')).toBe(true);
    expect(countsTowardsScore('NOT_EVALUABLE')).toBe(false);
  });
});

describe('summarizeScores', () => {
  it('counts each verdict and sums the score', () => {
    const items: GradedItem[] = [
      { category: 'EXTRACTION', verdict: 'CORRECT' },
      { category: 'EXTRACTION', verdict: 'PARTIAL' },
      { category: 'COMPREHENSION', verdict: 'INCORRECT' },
      { category: 'RELATION', verdict: 'NOT_EVALUABLE' },
    ];

    const { overall } = summarizeScores(items);
    expect(overall).toMatchObject({
      correct: 1,
      partial: 1,
      incorrect: 1,
      notEvaluable: 1,
      evaluated: 3,
      score: 1.5,
      percentage: 50,
    });
  });

  it('never lets a not-evaluable question drag the score down', () => {
    const withUngradable = summarizeScores([
      { category: 'EXTRACTION', verdict: 'CORRECT' },
      { category: 'EXTRACTION', verdict: 'NOT_EVALUABLE' },
    ]);
    const withoutIt = summarizeScores([{ category: 'EXTRACTION', verdict: 'CORRECT' }]);

    expect(withUngradable.overall.percentage).toBe(100);
    expect(withUngradable.overall.percentage).toBe(withoutIt.overall.percentage);
  });

  it('reports null, not zero, when nothing could be graded', () => {
    const { overall } = summarizeScores([{ category: 'RELATION', verdict: 'NOT_EVALUABLE' }]);
    expect(overall.evaluated).toBe(0);
    expect(overall.percentage).toBeNull();
    expect(overall.score).toBe(0);
  });

  it('reports null for an empty run', () => {
    expect(summarizeScores([]).overall.percentage).toBeNull();
  });

  it('breaks the score down by category', () => {
    const { byCategory } = summarizeScores([
      { category: 'EXTRACTION', verdict: 'CORRECT' },
      { category: 'EXTRACTION', verdict: 'CORRECT' },
      { category: 'COMPREHENSION', verdict: 'INCORRECT' },
      { category: 'RELATION', verdict: 'PARTIAL' },
    ]);

    expect(byCategory.EXTRACTION.percentage).toBe(100);
    expect(byCategory.COMPREHENSION.percentage).toBe(0);
    expect(byCategory.RELATION.percentage).toBe(50);
  });

  it('always reports all three categories, even when unused', () => {
    const { byCategory } = summarizeScores([{ category: 'EXTRACTION', verdict: 'CORRECT' }]);
    expect(Object.keys(byCategory).sort()).toEqual(['COMPREHENSION', 'EXTRACTION', 'RELATION']);
    expect(byCategory.RELATION.percentage).toBeNull();
  });

  it('rounds to two decimals rather than emitting float noise', () => {
    const { overall } = summarizeScores([
      { category: 'EXTRACTION', verdict: 'CORRECT' },
      { category: 'EXTRACTION', verdict: 'PARTIAL' },
      { category: 'EXTRACTION', verdict: 'INCORRECT' },
    ]);
    expect(overall.percentage).toBe(50);
    expect(overall.score).toBe(1.5);
  });
});
