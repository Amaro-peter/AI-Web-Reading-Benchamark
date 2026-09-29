import { describe, expect, it } from 'vitest';
import type { Question } from '../../src/domain/benchmark.js';
import { evaluateAnswer, heuristicJudge, PARTIAL_THRESHOLD } from '../../src/evaluation/judge.js';
import { NOT_IN_PAGE } from '../../src/providers/prompt.js';

function question(overrides: Partial<Question> = {}): Question {
  return {
    id: 'q',
    category: 'EXTRACTION',
    prompt: 'What?',
    expectedAnswer: 'Route 28',
    acceptableAnswers: [],
    ...overrides,
  };
}

function verdictFor(expectedAnswer: string | null, actualAnswer: string) {
  return heuristicJudge.evaluate({ question: question(), expectedAnswer, actualAnswer });
}

describe('heuristicJudge', () => {
  it('never invents a verdict when there is no gold answer', () => {
    expect(verdictFor(null, 'anything at all')).toBe('NOT_EVALUABLE');
    expect(verdictFor(null, '')).toBe('NOT_EVALUABLE');
  });

  it.each([
    ['Route 28', 'Route 28'],
    ['Route 28', 'route 28'],
    ['Route 28', '  ROUTE 28.  '],
    ['1914', 'It opened in 1914.'],
    ['Marta Ribeiro', 'The author is Marta Ribeiro.'],
    ['twenty five million', '25 million'],
  ])('grades %j answered as %j CORRECT', (expected, actual) => {
    expect(verdictFor(expected, actual)).toBe('CORRECT');
  });

  it.each([
    ['Marta Ribeiro Silva', 'Marta Ribeiro'],
    ['A network built for hills', 'built for hills'],
  ])('grades %j answered as %j PARTIAL', (expected, actual) => {
    expect(verdictFor(expected, actual)).toBe('PARTIAL');
  });

  it.each([
    ['Route 28', 'Route 15'],
    ['1914', '1995'],
    ['Marta Ribeiro', 'Jose Santos'],
    ['Route 28', ''],
    ['Route 28', '   '],
  ])('grades %j answered as %j INCORRECT', (expected, actual) => {
    expect(verdictFor(expected, actual)).toBe('INCORRECT');
  });

  it('needs more than one expected token before awarding PARTIAL', () => {
    // A single-token expectation is either matched or it is not.
    expect(verdictFor('1914', '19')).toBe('INCORRECT');
  });

  it('uses a documented partial threshold', () => {
    expect(PARTIAL_THRESHOLD).toBe(0.5);
  });
});

describe('abstention is a claim, not a near miss', () => {
  it('is CORRECT when the page really does not say', () => {
    expect(verdictFor(NOT_IN_PAGE, NOT_IN_PAGE)).toBe('CORRECT');
    expect(verdictFor(NOT_IN_PAGE, 'not in page')).toBe('CORRECT');
  });

  it('is INCORRECT when a model abstains although the page answers', () => {
    expect(verdictFor('Marta Ribeiro', NOT_IN_PAGE)).toBe('INCORRECT');
  });

  it('is INCORRECT when a model invents an answer the page does not support', () => {
    expect(verdictFor(NOT_IN_PAGE, 'Marta Ribeiro')).toBe('INCORRECT');
  });
});

describe('evaluateAnswer', () => {
  it('accepts any of the acceptable spellings', () => {
    const q = question({ expectedAnswer: '3,200', acceptableAnswers: ['3200'] });
    expect(evaluateAnswer(heuristicJudge, q, '3200')).toBe('CORRECT');
  });

  it('keeps the best verdict across candidates', () => {
    const q = question({
      expectedAnswer: 'Marta Ribeiro Silva',
      acceptableAnswers: ['Nobody Else'],
    });
    expect(evaluateAnswer(heuristicJudge, q, 'Marta Ribeiro')).toBe('PARTIAL');
  });

  it('stays NOT_EVALUABLE when there is no gold answer at all', () => {
    const q = question({ expectedAnswer: null, acceptableAnswers: [] });
    expect(evaluateAnswer(heuristicJudge, q, 'whatever')).toBe('NOT_EVALUABLE');
  });
});

describe('the judge is replaceable', () => {
  it('scoring calls whatever judge it is given', () => {
    const alwaysCorrect = { name: 'stub', evaluate: () => 'CORRECT' as const };
    expect(evaluateAnswer(alwaysCorrect, question(), 'total nonsense')).toBe('CORRECT');
  });

  it('a replacement judge can disagree with the default', () => {
    const alwaysIncorrect = { name: 'strict', evaluate: () => 'INCORRECT' as const };
    const q = question();
    expect(evaluateAnswer(heuristicJudge, q, 'Route 28')).toBe('CORRECT');
    expect(evaluateAnswer(alwaysIncorrect, q, 'Route 28')).toBe('INCORRECT');
  });
});
