'use client';

import { useCallback, useRef, useState } from 'react';
import { ProgressPanel } from '@/components/ProgressPanel';
import { ResultsPanel } from '@/components/ResultsPanel';
import { UrlForm } from '@/components/UrlForm';
import { BenchmarkRequestError, runBenchmark } from '@/lib/api';
import type { BenchmarkResult } from '@/lib/types';

type RunState =
  | { phase: 'idle' }
  | { phase: 'running' }
  | { phase: 'done'; result: BenchmarkResult }
  | { phase: 'failed'; message: string; code: string };

export default function HomePage() {
  const [state, setState] = useState<RunState>({ phase: 'idle' });
  const inFlight = useRef<AbortController | null>(null);

  const start = useCallback((url: string) => {
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;

    setState({ phase: 'running' });

    runBenchmark(url, { signal: controller.signal })
      .then((result) => {
        setState({ phase: 'done', result });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        setState(
          error instanceof BenchmarkRequestError
            ? { phase: 'failed', message: error.message, code: error.code }
            : { phase: 'failed', message: 'Something went wrong.', code: 'UNKNOWN_ERROR' },
        );
      });
  }, []);

  return (
    <main className="mx-auto max-w-5xl px-4 py-12 sm:py-16">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        AI Web Reading Benchmark
      </h1>
      <p className="mt-3 max-w-2xl text-slate-600 dark:text-slate-400">
        Teste quão bem diferentes IAs conseguem ler e extrair informações de uma página web.
      </p>

      <p className="mt-4 max-w-2xl rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
        <strong className="font-semibold">Experimental benchmark.</strong> Results depend on the
        page, the questions asked, the models configured and the evaluation method. A single run is
        evidence about one page, not a ranking of these models.
      </p>

      <UrlForm onSubmit={start} isRunning={state.phase === 'running'} />

      <div aria-live="polite" aria-atomic="false">
        {state.phase === 'running' && <ProgressPanel />}

        {state.phase === 'failed' && (
          <div
            role="alert"
            className="mt-8 rounded-xl border border-rose-300 bg-rose-50 p-4 text-sm dark:border-rose-900 dark:bg-rose-950/40"
          >
            <p className="font-semibold text-rose-900 dark:text-rose-200">
              The benchmark could not run
            </p>
            <p className="mt-1 text-rose-800 dark:text-rose-300">{state.message}</p>
            <p className="mt-2 font-mono text-xs text-rose-700 dark:text-rose-400">{state.code}</p>
          </div>
        )}
      </div>

      {state.phase === 'done' && <ResultsPanel result={state.result} />}

      <footer className="mt-16 border-t border-slate-200 pt-6 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
        <p>
          Pages are fetched server-side with SSRF protection; private and local addresses are
          refused. Provider API keys never leave the backend.
        </p>
      </footer>
    </main>
  );
}
