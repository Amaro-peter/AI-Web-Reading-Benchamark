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

describe('the partial-credit boundary', () => {
  it('awards PARTIAL at exactly the threshold', () => {
    // two of four expected tokens = 0.50
    expect(verdictFor('alpha beta gamma delta', 'alpha beta')).toBe('PARTIAL');
  });

  it('refuses PARTIAL just below the threshold', () => {
    // two of five expected tokens = 0.40
    expect(verdictFor('alpha beta gamma delta epsilon', 'alpha beta')).toBe('INCORRECT');
  });

  it('treats a single-token expectation as all or nothing', () => {
    expect(verdictFor('alpha', 'alpha')).toBe('CORRECT');
    expect(verdictFor('alpha', 'beta')).toBe('INCORRECT');
  });
});

describe('numbers must match exactly for partial credit', () => {
  it('refuses partial credit when the number is wrong', () => {
    expect(verdictFor('Route 28 Alfama line', 'Route 15 Alfama line')).toBe('INCORRECT');
  });

  it('refuses partial credit when the number is missing entirely', () => {
    expect(verdictFor('Route 28 Alfama line', 'the Alfama line route')).toBe('INCORRECT');
  });

  it('allows partial credit when every number matches', () => {
    expect(verdictFor('Route 28 Alfama district line', 'Route 28 district')).toBe('PARTIAL');
  });

  it('allows partial credit when the expectation has no numbers at all', () => {
    expect(verdictFor('Alfama district tram line', 'Alfama district')).toBe('PARTIAL');
  });

  it('matches a number written as a word against its digits', () => {
    expect(verdictFor('fifty eight trams', '58 trams')).toBe('CORRECT');
  });

  it('does not treat a longer number as a match', () => {
    expect(verdictFor('year 1914 opening', 'year 19141 opening')).toBe('INCORRECT');
  });
});

describe('evaluateAnswer keeps the strictly better verdict', () => {
  it('does not downgrade when a later candidate scores lower', () => {
    const q = question({ expectedAnswer: 'Route 28', acceptableAnswers: ['completely different'] });
    expect(evaluateAnswer(heuristicJudge, q, 'Route 28')).toBe('CORRECT');
  });

  it('upgrades when a later candidate scores higher', () => {
    const q = question({ expectedAnswer: 'completely different', acceptableAnswers: ['Route 28'] });
    expect(evaluateAnswer(heuristicJudge, q, 'Route 28')).toBe('CORRECT');
  });

  it('keeps PARTIAL over INCORRECT across candidates', () => {
    const q = question({
      expectedAnswer: 'nothing alike whatsoever',
      acceptableAnswers: ['alpha beta gamma delta'],
    });
    expect(evaluateAnswer(heuristicJudge, q, 'alpha beta')).toBe('PARTIAL');
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
