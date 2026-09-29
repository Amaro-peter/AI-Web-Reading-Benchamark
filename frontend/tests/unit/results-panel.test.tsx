import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ResultsPanel } from '@/components/ResultsPanel';
import { benchmarkResultFixture } from '../helpers/fixture';

describe('ResultsPanel', () => {
  it('reports the page title, URL and word count', () => {
    render(<ResultsPanel result={benchmarkResultFixture()} />);

    expect(screen.getAllByText("Lisbon's tram network turns 150").length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'https://fixtures.test/article' })).toBeInTheDocument();
    expect(screen.getByText('428')).toBeInTheDocument();
  });

  it('shows an overall score and a per-category breakdown for each provider', () => {
    render(<ResultsPanel result={benchmarkResultFixture()} />);

    const gemini = screen.getByRole('article', { name: 'Gemini' });
    expect(within(gemini).getByText('62.5%')).toBeInTheDocument();
    expect(within(gemini).getByText('Extraction')).toBeInTheDocument();
    expect(within(gemini).getByText('Comprehension')).toBeInTheDocument();
    expect(within(gemini).getByText('Relation')).toBeInTheDocument();
  });

  it('shows "n/a" rather than 0% for a category nothing could be graded in', () => {
    render(<ResultsPanel result={benchmarkResultFixture()} />);
    const card = screen.getByRole('article', { name: 'Gemini' });
    expect(within(card).getByText('n/a')).toBeInTheDocument();
    expect(within(card).queryByText('0%')).toBeNull();
  });

  it('explains an unavailable provider instead of scoring it zero', () => {
    render(<ResultsPanel result={benchmarkResultFixture()} />);

    const claude = screen.getByRole('article', { name: 'Claude' });
    expect(within(claude).getByText('Not run')).toBeInTheDocument();
    expect(within(claude).getByText(/ANTHROPIC_API_KEY is not configured/)).toBeInTheDocument();
    expect(within(claude).queryByText('0%')).toBeNull();
  });

  it('names the model each provider used', () => {
    render(<ResultsPanel result={benchmarkResultFixture()} />);
    expect(screen.getAllByText('test-model').length).toBeGreaterThan(0);
  });

  it('names the grading method', () => {
    render(<ResultsPanel result={benchmarkResultFixture()} />);
    expect(screen.getByText('heuristic')).toBeInTheDocument();
  });

  it('flags a page whose text was truncated before the models saw it', () => {
    const result = benchmarkResultFixture();
    result.page.truncated = true;
    render(<ResultsPanel result={result} />);
    expect(screen.getByText(/truncated before being sent/)).toBeInTheDocument();
  });

  it('shows the original URL when the page redirected', () => {
    const result = benchmarkResultFixture({
      url: 'https://old.test/a',
      finalUrl: 'https://new.test/b',
    });
    render(<ResultsPanel result={result} />);
    expect(screen.getByText(/redirected from https:\/\/old.test\/a/)).toBeInTheDocument();
  });
});

describe('the comparison table', () => {
  it('has one column per provider', () => {
    render(<ResultsPanel result={benchmarkResultFixture()} />);

    const table = screen.getByRole('table');
    const headers = within(table)
      .getAllByRole('columnheader')
      .map((cell) => cell.textContent);
    expect(headers).toEqual(['Question', 'Gemini', 'ChatGPT', 'Claude']);
  });

  it('has one row per question', () => {
    const result = benchmarkResultFixture();
    render(<ResultsPanel result={result} />);

    const table = screen.getByRole('table');
    // header row + one per question
    expect(within(table).getAllByRole('row')).toHaveLength(result.questions.length + 1);
  });

  it('shows the expected answer next to each question so grading can be checked', () => {
    render(<ResultsPanel result={benchmarkResultFixture()} />);
    expect(screen.getAllByText(/^Expected:/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Marta Ribeiro').length).toBeGreaterThan(0);
  });

  it('labels a question the page cannot answer rather than grading it', () => {
    render(<ResultsPanel result={benchmarkResultFixture()} />);
    expect(screen.getByText(/does not support this question/)).toBeInTheDocument();
  });

  it('labels every verdict in words, never by colour alone', () => {
    render(<ResultsPanel result={benchmarkResultFixture()} />);

    expect(screen.getAllByText('Correct').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Partial').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Incorrect').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Not evaluable').length).toBeGreaterThan(0);
  });

  it('shows the actual answers, not only the verdicts', () => {
    render(<ResultsPanel result={benchmarkResultFixture()} />);
    expect(screen.getAllByText('Something else').length).toBeGreaterThan(0);
    expect(screen.getAllByText('1873').length).toBeGreaterThan(0);
  });

  it('shows a provider error in place of an answer', () => {
    render(<ResultsPanel result={benchmarkResultFixture()} />);
    expect(screen.getAllByText('Gemini did not answer in time.').length).toBeGreaterThan(0);
  });

  it('marks cells for a provider that never ran', () => {
    render(<ResultsPanel result={benchmarkResultFixture()} />);
    // Claude has no answers at all: every one of its cells says so.
    expect(screen.getAllByText('Not run').length).toBeGreaterThan(1);
  });

  it('never presents a ranking or a winner', () => {
    const { container } = render(<ResultsPanel result={benchmarkResultFixture()} />);
    const text = (container.textContent ?? '').toLowerCase();
    for (const editorial of ['winner', 'best model', 'rank', 'worst', 'recommended']) {
      expect(text).not.toContain(editorial);
    }
  });
});
