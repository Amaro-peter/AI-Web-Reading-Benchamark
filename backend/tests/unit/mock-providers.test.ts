import { describe, expect, it } from 'vitest';
import {
  bestMatchingSentence,
  FailingProvider,
  MockProvider,
  ScriptedProvider,
} from '../../src/providers/mock.js';
import { NOT_IN_PAGE } from '../../src/providers/prompt.js';

const page = [
  'Route 28 opened in 1914 and climbs through Alfama.',
  'The tram network carried twenty five million passengers in 2023.',
  'A single ride bought on board costs three euros and twenty cents.',
].join(' ');

describe('bestMatchingSentence', () => {
  it('picks the sentence sharing the most content words with the question', () => {
    expect(bestMatchingSentence(page, 'How many passengers did the network carry?')).toBe(
      'The tram network carried twenty five million passengers in 2023.',
    );
  });

  it('returns null when the question has no content words', () => {
    expect(bestMatchingSentence(page, 'what is it?')).toBeNull();
  });

  it('returns null when nothing in the page overlaps', () => {
    expect(bestMatchingSentence(page, 'Describe the Antarctic penguin migration')).toBeNull();
  });

  it('is deterministic across calls', () => {
    const question = 'What does a single ride cost?';
    expect(bestMatchingSentence(page, question)).toBe(bestMatchingSentence(page, question));
  });
});

describe('MockProvider', () => {
  it('answers with the most relevant sentence', async () => {
    const provider = new MockProvider({ name: 'gemini', model: 'mock-1' });
    await expect(
      provider.answer({ pageContent: page, question: 'When did Route 28 open?' }),
    ).resolves.toContain('1914');
  });

  it('abstains with the fixed token when the page has no match', async () => {
    const provider = new MockProvider({ name: 'gemini', model: 'mock-1' });
    await expect(
      provider.answer({ pageContent: page, question: 'Who won the 1998 World Cup?' }),
    ).resolves.toBe(NOT_IN_PAGE);
  });

  it('the clause strategy returns only the first clause', async () => {
    const provider = new MockProvider({ name: 'openai', model: 'mock-2', strategy: 'clause' });
    const answer = await provider.answer({
      pageContent: 'The fare is three euros, which is double the card price.',
      question: 'What is the fare?',
    });
    expect(answer).toBe('The fare is three euros');
  });

  it('the abstain strategy never answers', async () => {
    const provider = new MockProvider({ name: 'claude', model: 'mock-3', strategy: 'abstain' });
    await expect(
      provider.answer({ pageContent: page, question: 'When did Route 28 open?' }),
    ).resolves.toBe(NOT_IN_PAGE);
  });

  it('honours a simulated latency', async () => {
    const provider = new MockProvider({ name: 'slow', model: 'mock-4', latencyMs: 30 });
    const started = Date.now();
    await provider.answer({ pageContent: page, question: 'When did Route 28 open?' });
    expect(Date.now() - started).toBeGreaterThanOrEqual(25);
  });
});

describe('ScriptedProvider', () => {
  it('returns the scripted answer for a known question', async () => {
    const provider = new ScriptedProvider('gemini', 'scripted', { 'Q1?': '1914' });
    await expect(provider.answer({ pageContent: page, question: 'Q1?' })).resolves.toBe('1914');
  });

  it('abstains for an unscripted question', async () => {
    const provider = new ScriptedProvider('gemini', 'scripted', {});
    await expect(provider.answer({ pageContent: page, question: 'Q9?' })).resolves.toBe(
      NOT_IN_PAGE,
    );
  });
});

describe('FailingProvider', () => {
  it('always rejects with a provider error', async () => {
    const provider = new FailingProvider('openai', 'broken');
    await expect(provider.answer()).rejects.toMatchObject({ code: 'PROVIDER_ERROR' });
  });
});
