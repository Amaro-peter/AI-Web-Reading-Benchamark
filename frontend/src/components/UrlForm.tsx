'use client';

import { useId, useRef, useState, type FormEvent } from 'react';

interface UrlFormProps {
  onSubmit: (url: string) => void;
  isRunning: boolean;
}

/**
 * URL entry.
 *
 * The submit button is never disabled to block an invalid value — that hides
 * why nothing happens. It is disabled only while a run is in flight, to stop
 * a double submit.
 */
const WEBARENA_PRESETS = [
  { label: 'Presets (WebArena benchmark sites)...', url: '' },
  {
    label: 'Books to Scrape (E-Commerce)',
    url: 'https://books.toscrape.com/catalogue/a-light-in-the-attic_1000/index.html',
  },
  {
    label: 'Wikipedia: Apollo 11 (Knowledge Base)',
    url: 'https://en.wikipedia.org/wiki/Apollo_11',
  },
  {
    label: 'Fastify Framework (Tech Landing)',
    url: 'https://fastify.dev',
  },
  {
    label: 'Hacker News (Forum & Community)',
    url: 'https://news.ycombinator.com',
  },
  {
    label: 'MDN: Button Element (Tech Docs)',
    url: 'https://developer.mozilla.org/en-US/docs/Web/HTML/Element/button',
  },
];

export function UrlForm({ onSubmit, isRunning }: UrlFormProps) {
  const inputId = useId();
  const hintId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState('');

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = inputRef.current;

    if (input && !input.checkValidity()) {
      // :user-invalid handles the visuals; assistive technology needs the
      // attribute set explicitly.
      input.setAttribute('aria-invalid', 'true');
      input.reportValidity();
      return;
    }

    input?.removeAttribute('aria-invalid');
    onSubmit(value.trim());
  }

  return (
    <form onSubmit={handleSubmit} noValidate={false} className="mt-8">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <label htmlFor={inputId} className="block text-sm font-medium">
          Page URL
        </label>
        <select
          aria-label="WebArena Presets"
          onChange={(event) => {
            if (event.target.value) {
              setValue(event.target.value);
            }
          }}
          disabled={isRunning}
          className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
        >
          {WEBARENA_PRESETS.map((p) => (
            <option key={p.label} value={p.url}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-2 flex flex-col gap-3 sm:flex-row">
        <input
          ref={inputRef}
          id={inputId}
          name="url"
          type="url"
          required
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            event.target.removeAttribute('aria-invalid');
          }}
          placeholder="https://example.com/article"
          autoComplete="url"
          inputMode="url"
          enterKeyHint="go"
          aria-describedby={hintId}
          disabled={isRunning}
          className="min-h-12 w-full flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-sky-600 disabled:opacity-60 user-invalid:border-rose-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
        />

        <button
          type="submit"
          disabled={isRunning}
          className="min-h-12 shrink-0 rounded-lg bg-sky-700 px-5 py-2 text-base font-medium text-white shadow-sm transition hover:bg-sky-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-sky-600 dark:hover:bg-sky-500"
        >
          {isRunning ? 'Running…' : 'Run Benchmark'}
        </button>
      </div>

      <div className="mt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-sm text-slate-600 dark:text-slate-400">
        <p id={hintId}>
          A public http:// or https:// page. Private and local addresses are refused.
        </p>
        <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500"></span>
          Supports React, Next.js &amp; dynamic SPAs via Playwright
        </span>
      </div>
    </form>
  );
}
