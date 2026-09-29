import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import HomePage from '@/app/page';
import { benchmarkResultFixture } from '../helpers/fixture';

const VALID_URL = 'https://example.com/article';

function mockFetchOnce(handler: () => Promise<Response>) {
  const spy = vi.fn(handler);
  vi.stubGlobal('fetch', spy);
  return spy;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  vi.useRealTimers();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('the page before a run', () => {
  it('shows the product title and description', () => {
    render(<HomePage />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'AI Web Reading Benchmark' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/ler e extrair informações de uma página web/i)).toBeInTheDocument();
  });

  it('states up front that the benchmark is experimental', () => {
    render(<HomePage />);
    expect(screen.getByText(/Experimental benchmark/)).toBeInTheDocument();
    expect(screen.getByText(/not a ranking of these models/)).toBeInTheDocument();
  });

  it('offers a labelled URL field and a Run Benchmark button', () => {
    render(<HomePage />);
    expect(screen.getByLabelText('Page URL')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Run Benchmark' })).toBeInTheDocument();
  });

  it('shows no results before anything has been run', () => {
    render(<HomePage />);
    expect(screen.queryByRole('table')).toBeNull();
  });
});

describe('running a benchmark', () => {
  it('posts the URL to the backend', async () => {
    const fetchSpy = mockFetchOnce(async () => jsonResponse(benchmarkResultFixture()));
    render(<HomePage />);

    await userEvent.type(screen.getByLabelText('Page URL'), VALID_URL);
    await userEvent.click(screen.getByRole('button', { name: 'Run Benchmark' }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
    const [, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({ url: VALID_URL });
  });

  it('shows the stages while the run is in flight, then the results', async () => {
    let resolve: ((value: Response) => void) | undefined;
    mockFetchOnce(
      () =>
        new Promise<Response>((r) => {
          resolve = r;
        }),
    );
    render(<HomePage />);

    await userEvent.type(screen.getByLabelText('Page URL'), VALID_URL);
    await userEvent.click(screen.getByRole('button', { name: 'Run Benchmark' }));

    expect(await screen.findByText('Benchmark in progress')).toBeInTheDocument();
    for (const stage of [
      'Fetching page…',
      'Running Gemini…',
      'Running ChatGPT…',
      'Running Claude…',
      'Evaluating answers…',
    ]) {
      expect(screen.getByText(stage)).toBeInTheDocument();
    }

    resolve?.(jsonResponse(benchmarkResultFixture()));

    expect(await screen.findByRole('heading', { name: 'Results' })).toBeInTheDocument();
    expect(screen.queryByText('Benchmark in progress')).toBeNull();
  });

  it('disables the button while running so the run is not submitted twice', async () => {
    mockFetchOnce(() => new Promise<Response>(() => undefined));
    render(<HomePage />);

    await userEvent.type(screen.getByLabelText('Page URL'), VALID_URL);
    await userEvent.click(screen.getByRole('button', { name: 'Run Benchmark' }));

    expect(await screen.findByRole('button', { name: 'Running…' })).toBeDisabled();
  });

  it('renders every provider and every question once the run completes', async () => {
    mockFetchOnce(async () => jsonResponse(benchmarkResultFixture()));
    render(<HomePage />);

    await userEvent.type(screen.getByLabelText('Page URL'), VALID_URL);
    await userEvent.click(screen.getByRole('button', { name: 'Run Benchmark' }));

    const table = await screen.findByRole('table');
    expect(table).toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'Gemini' })).toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'ChatGPT' })).toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'Claude' })).toBeInTheDocument();
  });
});

describe('when the run fails', () => {
  it('reports a backend error with its code, and keeps the form usable', async () => {
    mockFetchOnce(async () =>
      jsonResponse({ error: { code: 'BLOCKED_HOST', message: 'That host is not allowed.' } }, 400),
    );
    render(<HomePage />);

    await userEvent.type(screen.getByLabelText('Page URL'), 'https://intranet.example/');
    await userEvent.click(screen.getByRole('button', { name: 'Run Benchmark' }));

    const alert = await screen.findByRole('alert', { name: 'The benchmark could not run' });
    expect(alert).toHaveTextContent('That host is not allowed.');
    expect(alert).toHaveTextContent('BLOCKED_HOST');
    expect(screen.getByRole('button', { name: 'Run Benchmark' })).toBeEnabled();
  });

  it('reports a network failure in plain language', async () => {
    mockFetchOnce(() => Promise.reject(new TypeError('fetch failed')));
    render(<HomePage />);

    await userEvent.type(screen.getByLabelText('Page URL'), VALID_URL);
    await userEvent.click(screen.getByRole('button', { name: 'Run Benchmark' }));

    expect(
      await screen.findByRole('alert', { name: 'The benchmark could not run' }),
    ).toHaveTextContent(/Could not reach the benchmark service/);
  });

  it('reports a malformed response rather than rendering nothing', async () => {
    mockFetchOnce(
      async () =>
        new Response('not json', { status: 200, headers: { 'content-type': 'application/json' } }),
    );
    render(<HomePage />);

    await userEvent.type(screen.getByLabelText('Page URL'), VALID_URL);
    await userEvent.click(screen.getByRole('button', { name: 'Run Benchmark' }));

    expect(
      await screen.findByRole('alert', { name: 'The benchmark could not run' }),
    ).toHaveTextContent(/malformed response/);
  });

  it('does not submit an empty URL to the backend', async () => {
    const fetchSpy = mockFetchOnce(async () => jsonResponse(benchmarkResultFixture()));
    render(<HomePage />);

    await userEvent.click(screen.getByRole('button', { name: 'Run Benchmark' }));

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
