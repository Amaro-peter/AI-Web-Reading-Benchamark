'use client';

/**
 * Progress while a run is in flight.
 *
 * The backend answers a benchmark in a single response, so this cannot report
 * true per-stage progress. It lists the stages the run performs and marks the
 * whole sequence as in progress — an honest "this is what is happening"
 * rather than a fake progress bar that claims to know how far along it is.
 */
const BENCHMARK_STAGES = [
  'Fetching page…',
  'Extracting content…',
  'Running Gemini…',
  'Running ChatGPT…',
  'Running Claude…',
  'Evaluating answers…',
] as const;

export function ProgressPanel() {
  return (
    <section
      aria-labelledby="progress-heading"
      className="mt-8 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
    >
      <h2 id="progress-heading" className="flex items-center gap-2 text-sm font-semibold">
        <span
          aria-hidden="true"
          className="inline-block size-3 animate-pulse rounded-full bg-sky-600 dark:bg-sky-400"
        />
        Benchmark in progress
      </h2>

      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        The three models are queried in parallel, so the run takes about as long as the slowest one.
      </p>

      <ul className="mt-4 space-y-2" aria-hidden="true">
        {BENCHMARK_STAGES.map((stage) => (
          <li
            key={stage}
            className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300"
          >
            <span className="inline-block size-1.5 rounded-full bg-slate-400 dark:bg-slate-600" />
            {stage}
          </li>
        ))}
      </ul>
    </section>
  );
}
