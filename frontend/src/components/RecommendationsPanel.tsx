'use client';

import { useState } from 'react';
import type { AIReadinessScore, Optimization, ProviderId } from '@/lib/types';

interface RecommendationsPanelProps {
  readiness?: AIReadinessScore;
  optimizations?: Optimization[];
}

const MODEL_LABELS: Record<ProviderId, string> = {
  openai: 'ChatGPT',
  claude: 'Claude',
  gemini: 'Gemini',
};

export function RecommendationsPanel({ readiness, optimizations = [] }: RecommendationsPanelProps) {
  const [selectedModel, setSelectedModel] = useState<ProviderId | 'all'>('all');

  if (!readiness || optimizations.length === 0) {
    return null;
  }

  const filtered = optimizations.filter(
    (item) => selectedModel === 'all' || item.targetModels.includes(selectedModel),
  );

  const gradeColor =
    readiness.grade === 'A'
      ? 'border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'
      : readiness.grade === 'B'
        ? 'border-sky-500 bg-sky-50 text-sky-800 dark:bg-sky-950/40 dark:text-sky-200'
        : readiness.grade === 'C'
          ? 'border-amber-500 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200'
          : 'border-rose-500 bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200';

  return (
    <section aria-labelledby="readiness-heading" className="mt-12">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 id="readiness-heading" className="text-xl font-semibold">
            AI Web Readability &amp; Discoverability
          </h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Audit score and engineering guidance for website builders to optimize discovery and
            interaction across ChatGPT, Claude, and Gemini.
          </p>
        </div>

        <div
          className={`flex items-center gap-3 rounded-xl border px-4 py-2 text-center ${gradeColor}`}
        >
          <div>
            <span className="block text-xs uppercase tracking-wider font-semibold opacity-75">
              AI Readiness
            </span>
            <span className="text-2xl font-bold">{readiness.overall}/100</span>
          </div>
          <div className="text-3xl font-black">Grade {readiness.grade}</div>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Structure &amp; Headings
          </span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-lg font-semibold">{readiness.breakdown.structure}%</span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-full bg-sky-600 rounded-full"
              style={{ width: `${readiness.breakdown.structure}%` }}
            />
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Metadata &amp; Entity Grounding
          </span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-lg font-semibold">{readiness.breakdown.metadata}%</span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-full bg-emerald-600 rounded-full"
              style={{ width: `${readiness.breakdown.metadata}%` }}
            />
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Content Density &amp; Context
          </span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-lg font-semibold">{readiness.breakdown.contentDensity}%</span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-full bg-amber-600 rounded-full"
              style={{ width: `${readiness.breakdown.contentDensity}%` }}
            />
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Agent Action Affordances
          </span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-lg font-semibold">{readiness.breakdown.affordance}%</span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-full bg-purple-600 rounded-full"
              style={{ width: `${readiness.breakdown.affordance}%` }}
            />
          </div>
        </div>
      </div>

      {readiness.metrics && (
        <div className="mt-6 rounded-xl border border-sky-100 bg-sky-50/50 p-4 dark:border-sky-950 dark:bg-sky-950/20">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
            <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              Peer-Reviewed Scientific Metric Gauges
            </h4>
            <span className="text-xs text-sky-700 dark:text-sky-300 font-mono">
              Grounded in NeurIPS, ICLR &amp; TACL Research
            </span>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Semantic Info Density (SID)
                </span>
                <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold text-sky-800 dark:bg-sky-900/60 dark:text-sky-300">
                  TACL &apos;24
                </span>
              </div>
              <div className="mt-1 text-xl font-bold">{readiness.metrics.sid}%</div>
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                Signal-to-noise ratio: content tokens vs boilerplate/markup.
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Heading Path Consistency (HPCI)
                </span>
                <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold text-sky-800 dark:bg-sky-900/60 dark:text-sky-300">
                  ACL &apos;23
                </span>
              </div>
              <div className="mt-1 text-xl font-bold">{readiness.metrics.hpci}%</div>
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                Monotonicity &amp; hierarchy of H1-H6 headings (HTML-T5).
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Agent Affordance Completeness (AAC)
                </span>
                <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold text-sky-800 dark:bg-sky-900/60 dark:text-sky-300">
                  ICLR &apos;24
                </span>
              </div>
              <div className="mt-1 text-xl font-bold">{readiness.metrics.aac}%</div>
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                Accessibility tree grounding &amp; action resolution (WebArena).
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
        <h4 className="text-base font-semibold">Engineering Guidance &amp; Optimizations</h4>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Filter by AI:
          </span>
          {(['all', 'openai', 'claude', 'gemini'] as const).map((model) => (
            <button
              key={model}
              type="button"
              onClick={() => setSelectedModel(model)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                selectedModel === model
                  ? 'bg-sky-700 text-white dark:bg-sky-600'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              {model === 'all' ? 'All Models' : MODEL_LABELS[model]}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 space-y-4">
        {filtered.map((item) => {
          const badgeClass =
            item.severity === 'CRITICAL'
              ? 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900'
              : item.severity === 'IMPORTANT'
                ? 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900'
                : 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';

          return (
            <article
              key={item.id}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${badgeClass}`}
                  >
                    {item.severity}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {item.category}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {item.targetModels.map((m) => (
                    <span
                      key={m}
                      className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                    >
                      {MODEL_LABELS[m]}
                    </span>
                  ))}
                </div>
              </div>

              <h5 className="mt-3 text-base font-semibold text-slate-900 dark:text-slate-100">
                {item.title}
              </h5>

              <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
                {item.explanation}
              </p>

              <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm dark:border-slate-800 dark:bg-slate-950/60">
                <strong className="text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  How to Fix:
                </strong>
                <p className="mt-1 text-slate-800 dark:text-slate-200">{item.action}</p>

                {item.codeSnippet && (
                  <pre className="mt-2 overflow-x-auto rounded bg-slate-900 p-2.5 text-xs text-slate-100 font-mono">
                    <code>{item.codeSnippet}</code>
                  </pre>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
