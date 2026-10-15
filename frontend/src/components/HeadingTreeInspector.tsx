'use client';

interface HeadingTreeInspectorProps {
  title: string;
  headings: string[];
}

export function HeadingTreeInspector({ title, headings }: HeadingTreeInspectorProps) {
  const hasHeadings = headings.length > 0;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-4 dark:border-slate-800">
        <div>
          <h4 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Document Outline &amp; Heading Hierarchy
          </h4>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Structural heading tree extracted by LLM readability parser (H1-H6).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {headings.length} {headings.length === 1 ? 'section' : 'sections'}
          </span>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
              hasHeadings
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
            }`}
          >
            {hasHeadings ? 'Semantic Outline Present' : 'No Headings Found'}
          </span>
        </div>
      </div>

      <div className="mt-5 space-y-2">
        {/* Document Root H1 */}
        <div className="flex items-start gap-3 rounded-lg border border-sky-200 bg-sky-50/70 p-3 dark:border-sky-900 dark:bg-sky-950/30">
          <span className="shrink-0 rounded bg-sky-600 px-2 py-0.5 font-mono text-xs font-bold text-white dark:bg-sky-500">
            H1
          </span>
          <div className="min-w-0 flex-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-sky-800 dark:text-sky-300">
              Document Root Title
            </span>
            <p className="font-medium text-slate-900 dark:text-slate-100 text-sm truncate">
              {title || 'Untitled Document'}
            </p>
          </div>
        </div>

        {/* Section Headings Tree */}
        {!hasHeadings ? (
          <div className="rounded-lg border border-dashed border-rose-200 bg-rose-50/50 p-4 text-center dark:border-rose-900/50 dark:bg-rose-950/20">
            <p className="text-sm font-semibold text-rose-900 dark:text-rose-200">
              Missing Semantic Headings (H2 / H3)
            </p>
            <p className="mt-1 text-xs text-rose-700 dark:text-rose-300">
              Frontier LLMs (ChatGPT, Claude, Gemini) rely on monotonic heading trees to chunk and
              navigate web pages. Without &lt;h2&gt; sections, relational questions suffer high
              failure rates.
            </p>
          </div>
        ) : (
          <div className="relative pl-4 space-y-2 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
            {headings.map((heading, idx) => (
              <div
                key={`${idx}-${heading.slice(0, 20)}`}
                className="relative flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/50 p-2.5 transition hover:bg-slate-100/60 dark:border-slate-800/80 dark:bg-slate-800/40 dark:hover:bg-slate-800"
              >
                <span className="shrink-0 rounded bg-slate-200 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                  H2
                </span>
                <span className="text-xs text-slate-400 font-mono">#{idx + 1}</span>
                <p className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">
                  {heading}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
