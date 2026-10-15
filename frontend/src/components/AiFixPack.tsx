'use client';

import { useState } from 'react';
import type { PageSummary } from '@/lib/types';

interface AiFixPackProps {
  page: PageSummary;
  url: string;
}

export function AiFixPack({ page, url }: AiFixPackProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const cleanTitle = page.title || 'Page Title';
  const cleanDesc = cleanTitle + ' - Detailed factual guide and structured web resource.';
  const cleanAuthor = page.byline || 'Editorial Team';
  const cleanSiteName = page.siteName || 'Website';

  const jsonLdSnippet = `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "${cleanTitle.replace(/"/g, '\\"')}",
  "description": "${cleanDesc.replace(/"/g, '\\"')}",
  "author": {
    "@type": "Person",
    "name": "${cleanAuthor.replace(/"/g, '\\"')}"
  },
  "publisher": {
    "@type": "Organization",
    "name": "${cleanSiteName.replace(/"/g, '\\"')}"
  },
  "mainEntityOfPage": "${url}"
}
</script>`;

  const metaSnippet = `<!-- AI Discovery & Crawler Metadata -->
<meta name="description" content="${cleanDesc.replace(/"/g, '&quot;')}">
<meta name="author" content="${cleanAuthor.replace(/"/g, '&quot;')}">
<meta property="og:title" content="${cleanTitle.replace(/"/g, '&quot;')}">
<meta property="og:description" content="${cleanDesc.replace(/"/g, '&quot;')}">
<meta property="og:type" content="article">
<meta property="og:url" content="${url}">
<meta name="twitter:card" content="summary_large_image">`;

  const robotsSnippet = `# robots.txt - Frontier AI Search Permissions
User-agent: GPTBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: Google-Extended
Allow: /`;

  const ariaSnippet = `<!-- Accessible Action Affordance (WebArena / Mind2Web Standard) -->
<button
  type="button"
  aria-label="Submit search query"
  class="action-btn"
>
  Search
</button>

<a
  href="${url}"
  aria-label="Read full documentation on ${cleanTitle.replace(/"/g, '&quot;')}"
>
  Read Documentation
</a>`;

  function copyText(key: string, text: string) {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  }

  function copyAll() {
    const bundle = `<!-- === AI WEB READABILITY COMPLETE FIX PACK === -->
<!-- Generated for: ${url} -->

${jsonLdSnippet}

${metaSnippet}

${ariaSnippet}

# === robots.txt ===
${robotsSnippet}
`;
    copyText('all', bundle);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
        <div>
          <h4 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            One-Click AI Optimization Fix Pack
          </h4>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Copy-paste ready code tailored to this page to maximize score across ChatGPT, Claude,
            and Gemini.
          </p>
        </div>
        <button
          type="button"
          onClick={copyAll}
          className="rounded-lg bg-sky-700 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-sky-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 dark:bg-sky-600 dark:hover:bg-sky-500"
        >
          {copiedKey === 'all' ? '✓ Complete Bundle Copied' : 'Copy Complete AI Bundle'}
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Schema.org JSON-LD */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              1. Schema.org JSON-LD Microdata
            </span>
            <button
              type="button"
              onClick={() => copyText('jsonld', jsonLdSnippet)}
              className="text-xs font-medium text-sky-600 hover:text-sky-700 dark:text-sky-400"
            >
              {copiedKey === 'jsonld' ? '✓ Copied' : 'Copy'}
            </button>
          </div>
          <pre className="mt-3 overflow-x-auto rounded-lg bg-slate-50 p-3 font-mono text-[11px] leading-relaxed text-slate-800 dark:bg-slate-950 dark:text-slate-200">
            {jsonLdSnippet}
          </pre>
        </div>

        {/* Semantic Meta Tags */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              2. Semantic Head Metadata
            </span>
            <button
              type="button"
              onClick={() => copyText('meta', metaSnippet)}
              className="text-xs font-medium text-sky-600 hover:text-sky-700 dark:text-sky-400"
            >
              {copiedKey === 'meta' ? '✓ Copied' : 'Copy'}
            </button>
          </div>
          <pre className="mt-3 overflow-x-auto rounded-lg bg-slate-50 p-3 font-mono text-[11px] leading-relaxed text-slate-800 dark:bg-slate-950 dark:text-slate-200">
            {metaSnippet}
          </pre>
        </div>

        {/* robots.txt for AI bots */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              3. AI Crawler Directives (robots.txt)
            </span>
            <button
              type="button"
              onClick={() => copyText('robots', robotsSnippet)}
              className="text-xs font-medium text-sky-600 hover:text-sky-700 dark:text-sky-400"
            >
              {copiedKey === 'robots' ? '✓ Copied' : 'Copy'}
            </button>
          </div>
          <pre className="mt-3 overflow-x-auto rounded-lg bg-slate-50 p-3 font-mono text-[11px] leading-relaxed text-slate-800 dark:bg-slate-950 dark:text-slate-200">
            {robotsSnippet}
          </pre>
        </div>

        {/* ARIA Affordance Snippets */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              4. Agent Accessible Action Markup
            </span>
            <button
              type="button"
              onClick={() => copyText('aria', ariaSnippet)}
              className="text-xs font-medium text-sky-600 hover:text-sky-700 dark:text-sky-400"
            >
              {copiedKey === 'aria' ? '✓ Copied' : 'Copy'}
            </button>
          </div>
          <pre className="mt-3 overflow-x-auto rounded-lg bg-slate-50 p-3 font-mono text-[11px] leading-relaxed text-slate-800 dark:bg-slate-950 dark:text-slate-200">
            {ariaSnippet}
          </pre>
        </div>
      </div>
    </div>
  );
}
