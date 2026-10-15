'use client';

import { useState } from 'react';
import { formatDuration, formatNumber } from '@/lib/format';
import { PROVIDER_IDS, type BenchmarkResult } from '@/lib/types';
import { ComparisonTable } from './ComparisonTable';
import { ProviderScoreCard } from './ProviderScoreCard';
import { RecommendationsPanel } from './RecommendationsPanel';
import { HeadingTreeInspector } from './HeadingTreeInspector';
import { AiFixPack } from './AiFixPack';
import { AcademicExportHub } from './AcademicExportHub';

export function ResultsPanel({ result }: { result: BenchmarkResult }) {
  const [copiedLatex, setCopiedLatex] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'outline' | 'fixpack' | 'academic'>(
    'overview',
  );

  function downloadJson() {
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `benchmark-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadCsv() {
    const headers = [
      'Question ID',
      'Category',
      'Question',
      'Expected Answer',
      'Provider',
      'Model',
      'Actual Answer',
      'Verdict',
      'Score',
      'Duration (ms)',
    ];
    const rows = [headers.join(',')];

    for (const q of result.questions) {
      for (const id of PROVIDER_IDS) {
        const p = result.results[id];
        if (!p) continue;
        const answer = p.answers.find((a) => a.questionId === q.id);
        const cleanPrompt = (q.prompt || '').replace(/"/g, '""');
        const cleanExpected = (q.expectedAnswer || '').replace(/"/g, '""');
        const cleanActual = (answer?.answer || answer?.error?.message || 'Not run').replace(
          /"/g,
          '""',
        );
        rows.push(
          `"${q.id}","${q.category}","${cleanPrompt}","${cleanExpected}","${p.label}","${p.model}","${cleanActual}","${answer?.verdict || 'NOT_EVALUABLE'}",${answer?.score ?? 0},${answer?.durationMs ?? 0}`,
        );
      }
    }

    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `benchmark-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function copyLatexTable() {
    let tex = `% --- Academic Paper LaTeX Table ---
\\begin{table}[h]
\\centering
\\caption{Evaluation Results on ${result.page.title.replace(/[&%$#_{}]/g, '\\$&')}}
\\label{tab:benchmark_run}
\\begin{tabular}{lcccc}
\\toprule
\\textbf{Model} & \\textbf{Overall (\\%)} & \\textbf{Extr} & \\textbf{Comp} & \\textbf{Rel} \\\\
\\midrule
`;
    for (const id of PROVIDER_IDS) {
      const p = result.results[id];
      if (!p || !p.scores) continue;
      const overall =
        p.scores.overall.percentage !== null
          ? `${p.scores.overall.percentage.toFixed(1)}\\%`
          : 'N/A';
      const extr =
        p.scores.byCategory.EXTRACTION.percentage !== null
          ? `${p.scores.byCategory.EXTRACTION.percentage.toFixed(1)}\\%`
          : 'N/A';
      const comp =
        p.scores.byCategory.COMPREHENSION.percentage !== null
          ? `${p.scores.byCategory.COMPREHENSION.percentage.toFixed(1)}\\%`
          : 'N/A';
      const rel =
        p.scores.byCategory.RELATION.percentage !== null
          ? `${p.scores.byCategory.RELATION.percentage.toFixed(1)}\\%`
          : 'N/A';
      tex += `${p.label.padEnd(16)} & ${overall} & ${extr} & ${comp} & ${rel} \\\\\n`;
    }
    tex += `\\bottomrule
\\end{tabular}
\\end{table}
`;
    if (result.readiness?.metrics) {
      tex += `% --- Scientific Metric Gauges (Peer-Reviewed Dimensions) ---
% Semantic Information Density (SID): ${result.readiness.metrics.sid}\\% (GEO / TACL '24)
% Heading Path Consistency Index (HPCI): ${result.readiness.metrics.hpci}\\% (HTML-T5 / ACL '23)
% Accessibility Affordance Completeness (AAC): ${result.readiness.metrics.aac}\\% (WebArena / ICLR '24)
`;
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(tex);
    }
    setCopiedLatex(true);
    setTimeout(() => setCopiedLatex(false), 2500);
  }

  return (
    <section aria-labelledby="results-heading" className="mt-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 id="results-heading" className="text-xl font-semibold">
          Results
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={copyLatexTable}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            {copiedLatex ? 'LaTeX Copied!' : 'Copy LaTeX Table'}
          </button>
          <button
            type="button"
            onClick={downloadCsv}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Export CSV
          </button>
          <button
            type="button"
            onClick={downloadJson}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Export JSON
          </button>
        </div>
      </div>

      <dl className="mt-4 grid gap-x-6 gap-y-3 rounded-xl border border-slate-200 bg-white p-4 text-sm sm:grid-cols-2 dark:border-slate-800 dark:bg-slate-900">
        <div className="sm:col-span-2">
          <dt className="text-slate-600 dark:text-slate-400">Page</dt>
          <dd className="font-medium">{result.page.title}</dd>
        </div>

        <div className="sm:col-span-2">
          <dt className="text-slate-600 dark:text-slate-400">URL</dt>
          <dd className="break-all">
            <a
              href={result.finalUrl}
              rel="noopener noreferrer nofollow"
              target="_blank"
              className="text-sky-700 underline underline-offset-2 hover:text-sky-900 dark:text-sky-400 dark:hover:text-sky-300"
            >
              {result.finalUrl}
            </a>
            {result.finalUrl !== result.url && (
              <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">
                (redirected from {result.url})
              </span>
            )}
          </dd>
        </div>

        <div>
          <dt className="text-slate-600 dark:text-slate-400">Words extracted</dt>
          <dd className="tabular-nums">
            {formatNumber(result.page.wordCount)}
            {result.page.truncated && (
              <span className="ml-2 text-xs text-amber-700 dark:text-amber-400">
                truncated before being sent to the models
              </span>
            )}
          </dd>
        </div>

        <div>
          <dt className="text-slate-600 dark:text-slate-400">Model time</dt>
          <dd className="tabular-nums">{formatDuration(result.durationMs)}</dd>
        </div>

        {result.page.byline !== null && (
          <div>
            <dt className="text-slate-600 dark:text-slate-400">Author</dt>
            <dd>{result.page.byline}</dd>
          </div>
        )}

        {result.page.siteName !== null && (
          <div>
            <dt className="text-slate-600 dark:text-slate-400">Site</dt>
            <dd>{result.page.siteName}</dd>
          </div>
        )}

        <div>
          <dt className="text-slate-600 dark:text-slate-400">Extraction Engine</dt>
          <dd className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs text-slate-700 dark:text-slate-300">
              {result.page.extractionStrategy}
            </span>
            {result.page.extractionStrategy === 'dynamic-playwright' ? (
              <span className="inline-flex items-center gap-1 rounded bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                <span>⚡</span> Dynamic Browser (Playwright / Chromium)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                <span>📄</span> Static Parser
              </span>
            )}
          </dd>
        </div>

        <div>
          <dt className="text-slate-600 dark:text-slate-400">Grading method</dt>
          <dd>{result.judge}</dd>
        </div>
      </dl>

      <div className="mt-8 border-b border-slate-200 dark:border-slate-800">
        <nav className="flex space-x-2 sm:space-x-4 overflow-x-auto" aria-label="Result tabs">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`whitespace-nowrap pb-3 text-sm font-semibold border-b-2 transition ${
              activeTab === 'overview'
                ? 'border-sky-600 text-sky-700 dark:border-sky-400 dark:text-sky-300'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            Overview &amp; Answers
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('outline')}
            className={`whitespace-nowrap pb-3 text-sm font-semibold border-b-2 transition ${
              activeTab === 'outline'
                ? 'border-sky-600 text-sky-700 dark:border-sky-400 dark:text-sky-300'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            Heading Outline ({result.page.headings.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('fixpack')}
            className={`whitespace-nowrap pb-3 text-sm font-semibold border-b-2 transition ${
              activeTab === 'fixpack'
                ? 'border-sky-600 text-sky-700 dark:border-sky-400 dark:text-sky-300'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            AI Fix Pack
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('academic')}
            className={`whitespace-nowrap pb-3 text-sm font-semibold border-b-2 transition ${
              activeTab === 'academic'
                ? 'border-sky-600 text-sky-700 dark:border-sky-400 dark:text-sky-300'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            Academic &amp; BibTeX
          </button>
        </nav>
      </div>

      {activeTab === 'overview' && (
        <div className="mt-6 space-y-8">
          <div>
            <h3 className="text-lg font-semibold">Scores</h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Correct = 1, partial = 0.5, incorrect = 0. Questions the page cannot answer are
              excluded from the total rather than counted as failures.
            </p>

            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {PROVIDER_IDS.map((id) => {
                const provider = result.results[id];
                return provider === undefined ? null : (
                  <ProviderScoreCard key={id} result={provider} />
                );
              })}
            </div>
          </div>

          <RecommendationsPanel readiness={result.readiness} optimizations={result.optimizations} />

          <div>
            <h3 className="text-lg font-semibold">Every answer</h3>
            <p className="mt-1 mb-4 text-sm text-slate-600 dark:text-slate-400">
              Nothing is hidden or summarised away — the expected answer is shown next to each
              question so you can check the grading yourself.
            </p>

            <ComparisonTable result={result} />
          </div>
        </div>
      )}

      {activeTab === 'outline' && (
        <div className="mt-6">
          <HeadingTreeInspector title={result.page.title} headings={result.page.headings} />
        </div>
      )}

      {activeTab === 'fixpack' && (
        <div className="mt-6">
          <AiFixPack page={result.page} url={result.finalUrl || result.url} />
        </div>
      )}

      {activeTab === 'academic' && (
        <div className="mt-6">
          <AcademicExportHub result={result} />
        </div>
      )}
    </section>
  );
}
