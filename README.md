# AI Web Reading Benchmark

Measures how well different AIs read a web page and extract information from it.

You give it a URL. It fetches the page, extracts the main content, asks the same
small set of questions about it to **Gemini**, **ChatGPT** and **Claude** in
parallel, grades every answer against facts read off the page, and shows the
results side by side.

> **This is an experimental benchmark.** A result depends on the page, the
> questions asked, the models configured and the evaluation method. A single run
> is evidence about one page — it is not a ranking of these models, and the
> product never presents it as one.

---

## Contents

- [What it does](#what-it-does)
- [Architecture](#architecture)
- [Stack](#stack)
- [Installation](#installation)
- [Environment variables](#environment-variables)
- [Running locally](#running-locally)
- [Commands](#commands)
- [Testing](#testing)
- [Local CI](#local-ci)
- [Pre-push hook](#pre-push-hook)
- [Mutation testing](#mutation-testing)
- [Security testing](#security-testing)
- [SonarQube](#sonarqube)
- [Deploying the backend to Railway](#deploying-the-backend-to-railway)
- [Deploying the frontend to Vercel](#deploying-the-frontend-to-vercel)
- [Limitations](#limitations)

---

## What it does

1. Validates the URL, then checks the host is safe to fetch (see
   [SSRF protection](#ssrf-protection)).
2. Fetches the page under a timeout, a byte budget and a redirect limit.
3. Extracts the main content with Mozilla Readability.
4. Builds five questions grounded in that page, across three categories.
5. Asks all three providers the same questions, in parallel.
6. Grades each answer.
7. Returns per-category and overall scores, plus every individual answer.

### The questions

Five templates, filled in from the page. This is deliberately a small fixed
battery rather than a generator: **reproducibility matters more than
sophistication**, and the same page must always produce the same questions and
the same expected answers.

| # | Category | Question |
|---|---|---|
| 1 | `EXTRACTION` | What is the title of this page? |
| 2 | `EXTRACTION` | Who wrote it? (or exactly `NOT IN PAGE`) |
| 3 | `EXTRACTION` | What is the first section heading? |
| 4 | `COMPREHENSION` | A sentence from the page with one value removed — supply it |
| 5 | `RELATION` | Under which section heading does the page discuss "&lt;term&gt;"? |

An expected answer is **only ever read off the page, never invented**. When a
page cannot support a template — no headings, no numeric sentence, no sections —
that question's expected answer is `null` and it is reported `NOT_EVALUABLE`
rather than guessed at.

### Scoring

| Verdict | Score |
|---|---|
| `CORRECT` | 1 |
| `PARTIAL` | 0.5 |
| `INCORRECT` | 0 |
| `NOT_EVALUABLE` | excluded from the total |

`NOT_EVALUABLE` is excluded from the denominator, so a question nobody could
have answered neither rewards nor punishes a model. When nothing on a run could
be graded, the score is reported as `null`, never `0%` — "we could not measure
this" and "it got everything wrong" are different results.

### Evaluation

Grading lives in `backend/src/evaluation/` behind a `Judge` interface, so the
rule set can be replaced without touching the orchestrator or the API.

The default judge is **deterministic string comparison, not an LLM**. Every
question here has a gold answer read directly off the page, so grading needs no
judgement — and an LLM judge would reintroduce exactly the variance the
benchmark is trying to measure, while costing money and making results
irreproducible. If you do want LLM-as-a-judge, implement `Judge`, pass it to
`runBenchmark`, and the reported `judge` field will name it.

Comparison normalises case, accents, punctuation and digit grouping, folds
number words onto digits ("twenty five" → 25), and awards partial credit at 50%
token overlap — except that **a wrong or missing number never earns partial
credit**, because the number is usually the whole answer.

---

## Architecture

```
/
├── backend/                  Fastify API, deployed to Railway
│   ├── src/
│   │   ├── config/           env parsing, model config, secret redaction
│   │   ├── domain/           categories, verdicts, errors, text helpers
│   │   ├── scraper/          URL validation → SSRF guard → fetch → extract
│   │   ├── providers/        one AIProvider seam + three SDK adapters + mocks
│   │   ├── evaluation/       normalisation, Judge, scoring
│   │   ├── benchmark/        question generation, orchestration
│   │   └── http/             app, routes
│   └── tests/                unit · integration · regression · spec · security · smoke
├── frontend/                 Next.js single page, deployed to Vercel
│   ├── src/app/              the page
│   ├── src/components/       form, progress, results, table
│   └── src/lib/              API client, types, formatting
├── e2e/                      Playwright system tests + fixture server
├── scripts/                  CI pipeline, coverage, audit, sonar
└── docs/SPEC.md              the original project specification
```

**Request flow.** `HTTP → validation → scraping → benchmark → providers →
evaluation → response`. Every layer is reached through an injectable seam, which
is why the integration tests can drive the real route with the network and the
providers stubbed.

**Providers.** Every vendor is adapted to one narrow interface, so nothing
downstream imports an SDK:

```ts
interface AIProvider {
  readonly name: string;
  readonly model: string;
  answer(input: { pageContent: string; question: string }): Promise<string>;
}
```

A missing API key never breaks a run: that provider is reported `unavailable`
with the name of the variable that would enable it, and the others still
execute. Model ids live in one place (`backend/src/config/models.ts`) and can be
overridden per provider.

### API

**`GET /api/health`** → `200`

```json
{ "status": "ok", "service": "AI Web Reading Benchmark", "version": "0.1.0", "uptimeSeconds": 12 }
```

**`POST /api/benchmark`**

```json
{ "url": "https://example.com/article" }
```

```jsonc
{
  "url": "…",
  "finalUrl": "…",
  "page": { "title": "…", "wordCount": 428, "truncated": false, /* … */ },
  "questions": [{ "id": "q1-title", "category": "EXTRACTION", "prompt": "…", "expectedAnswer": "…" }],
  "results": {
    "gemini": { "status": "ok", "model": "…", "answers": [ /* … */ ], "scores": { /* … */ } },
    "openai": { "status": "unavailable", "reason": "OPENAI_API_KEY is not configured.", "scores": null },
    "claude": { /* … */ }
  },
  "judge": "heuristic",
  "disclaimer": "Experimental benchmark. …"
}
```

Error responses are `{ "error": { "code": "BLOCKED_HOST", "message": "…" } }`.
Codes: `INVALID_URL`, `UNSUPPORTED_SCHEME`, `BLOCKED_HOST` (400),
`RESPONSE_TOO_LARGE` (413), `TIMEOUT` (504), and `DNS_FAILURE`, `HTTP_ERROR`,
`UNSUPPORTED_CONTENT_TYPE`, `TOO_MANY_REDIRECTS`, `FETCH_FAILED`,
`EMPTY_CONTENT` (502).

---

## Stack

| | |
|---|---|
| **Backend** | Node.js, TypeScript (strict), Fastify, Zod, Mozilla Readability + jsdom, ipaddr.js |
| **Frontend** | Next.js (App Router), React, TypeScript (strict), Tailwind CSS |
| **Providers** | `@anthropic-ai/sdk`, `openai`, `@google/genai` |
| **Testing** | Vitest, Fastify `inject`, React Testing Library, Playwright, StrykerJS |
| **Quality** | ESLint, Prettier, Knip, SonarQube, npm audit, Gitleaks |
| **Deploy** | Railway (backend), Vercel (frontend) |

---

## Installation

Requires **Node.js ≥ 20.11** (developed on 24).

```bash
git clone https://github.com/Amaro-peter/AI-Web-Reading-Benchamark.git
cd AI-Web-Reading-Benchamark
npm ci
```

`npm ci` installs both workspaces. If npm reports packages with unapproved
install scripts, run `npm approve-scripts --allow-scripts-pending` — `esbuild`
and `unrs-resolver` need theirs to build native binaries.

To run the E2E suite you also need the browser: `npx playwright install chromium`.

---

## Environment variables

### Backend — `backend/.env`

Copy the template and fill it in:

```bash
cp backend/.env.example backend/.env
```

The server reads `backend/.env` at startup using Node's built-in
`process.loadEnvFile` (no `dotenv` dependency). **A variable already set in the
real environment wins over the file**, so the credentials Railway injects are
never shadowed by a stale `.env`. A missing `.env` is not an error.

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3001` | HTTP port |
| `HOST` | `0.0.0.0` | bind address |
| `NODE_ENV` | `development` | `development` \| `test` \| `production` |
| `FRONTEND_URL` | `http://localhost:3000` | the origin allowed by CORS |
| `GEMINI_API_KEY` | — | missing ⇒ Gemini reported `unavailable` |
| `OPENAI_API_KEY` | — | missing ⇒ ChatGPT reported `unavailable` |
| `ANTHROPIC_API_KEY` | — | missing ⇒ Claude reported `unavailable` |
| `GEMINI_MODEL` | `gemini-2.5-pro` | model override |
| `OPENAI_MODEL` | `gpt-4o` | model override |
| `ANTHROPIC_MODEL` | `claude-opus-5` | model override |
| `AI_PROVIDER_MODE` | `real` | `mock` uses deterministic in-process providers |
| `SCRAPER_TIMEOUT_MS` | `10000` | page fetch timeout |
| `SCRAPER_MAX_BYTES` | `2000000` | response size cap |
| `MAX_CONTENT_CHARS` | `12000` | cap on text sent to a model |
| `PROVIDER_TIMEOUT_MS` | `30000` | per-model-call timeout |
| `SCRAPER_ALLOWED_HOSTS` | *(empty)* | hostnames exempt from the private-address guard — see below |

> **The default model line-up is not matched for capability tier.** A flagship
> model and a fast model will not produce comparable results. Pin comparable
> models with the `*_MODEL` variables if you want a fair comparison. Every
> result echoes the model that produced it.

### Frontend — `frontend/.env.local`

```bash
cp frontend/.env.example frontend/.env.local
```

| Variable | Default | Purpose |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001` | backend base URL |

**No secret may ever go in a `NEXT_PUBLIC_*` variable** — those are inlined into
the browser bundle. Provider keys exist only in the backend environment, and a
test suite asserts no key name is referenced from frontend sources.

> `NEXT_PUBLIC_*` is inlined **at build time**, not read at runtime. Changing it
> requires a rebuild; on Vercel it must be set before the build runs.

---

## Running locally

```bash
npm run dev
```

Backend on `http://localhost:3001`, frontend on `http://localhost:3000`.

**With no API keys at all** the app still works end to end — all three providers
are simply reported as unavailable. To see a full result without spending
anything, run the backend with deterministic stand-ins:

```bash
AI_PROVIDER_MODE=mock npm run dev
```

---

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | run both apps in development |
| `npm run build` | production build of backend + frontend |
| `npm run typecheck` | TypeScript, zero errors accepted |
| `npm run lint` | ESLint |
| `npm run format` / `npm run format:check` | Prettier |
| `npm run dead-code` | Knip |
| `npm run test:unit` | unit tests |
| `npm run test:integration` | integration tests |
| `npm run test:regression` | regression tests |
| `npm run test:spec` | specification tests |
| `npm run test:security` | security tests |
| `npm run test:smoke` | smoke tests |
| `npm run test:mutation` | mutation tests |
| `npm run test:e2e` | system / E2E tests |
| `npm run test:live` | **manual only** — real APIs, costs money |
| `npm run coverage` | coverage report |
| `npm run coverage:verify` | fail below the coverage threshold |
| `npm run security:audit` | `npm audit` + Gitleaks |
| `npm run quality:sonar` | SonarQube analysis when available |
| `npm run ci` | the full pipeline |

---

## Testing

Tests are not a final step — every component was built with its tests.

| Suite | Where | What it covers |
|---|---|---|
| **Unit** | `backend/tests/unit`, `frontend/tests/unit` | validation, SSRF, extraction, questions, scoring, normalisation, provider adapters, config, error handling, components |
| **Integration** | `backend/tests/integration` | the real route via `fastify.inject`: valid and invalid URLs, empty page, scraping errors, unavailable provider, provider error, multiple providers, timeouts |
| **Regression** | `backend/tests/regression` | fixed HTML fixtures with exact assertions on title, extracted content, questions, scoring and the API wire shape |
| **Specification** | `backend/tests/spec` | each product requirement as one executable statement |
| **Security** | `backend/tests/security`, `frontend/tests/security` | SSRF, invalid URLs, oversized input, malformed and malicious HTML, prompt-injection awareness, secret exposure |
| **Smoke** | `backend/tests/smoke`, `frontend/tests/smoke`, `e2e/smoke.spec.ts` | the service boots, `/api/health` is 200, the frontend loads |
| **E2E** | `e2e/` | browser → frontend → backend → mock providers → result |

**No test ever calls a real AI API.** The test and E2E environments run with
`AI_PROVIDER_MODE=mock`, so it cannot happen by accident. `npm run test:live` is
the one opt-in path; it is never part of `npm run ci`, requires the keys to be
set explicitly, and costs money.

Run a single test:

```bash
npx vitest run tests/unit/judge.test.ts -t "awards PARTIAL at exactly the threshold" --root backend
```

### Regression policy

When a bug is found: reproduce it, add the test, fix the code, keep the test.
The regression suite has already earned this — it caught Mozilla Readability
0.6 starting to include the byline paragraph in the article body, which would
otherwise have silently changed every word count.

---

## Local CI

```bash
npm run ci
```

Runs every gate in order, stops at the first failure of a required stage, and
exits non-zero:

`clean → install → typecheck → lint → format → dead-code → unit → integration →
regression → spec → security → audit → smoke → mutation → build → e2e →
coverage → coverage verification → SonarQube`

Smoke tests run before the slow suites. The summary reports each stage and names
any stage that was **NOT RUN** because the pipeline stopped earlier — it never
reports a stage it did not execute.

A full run takes roughly **9 minutes**, most of it mutation testing.

`CI_SKIP=<stage,…>` exists for debugging one stage in isolation. It prints a
warning, and such a run is explicitly **not** a green pipeline.

---

## Pre-push hook

A Husky `pre-push` hook runs `npm run ci`. If any required stage fails, the push
is blocked.

`git push --no-verify` bypasses the hook. **It is not part of the normal
workflow of this project.** A push that skipped the pipeline has not been
verified and must not be described as one that was.

---

## Mutation testing

```bash
npm run test:mutation
```

StrykerJS, scoped to the modules where a silently wrong branch is dangerous:
URL validation, SSRF protection, evaluation and scoring, secret redaction, and
benchmark orchestration. Running it over jsdom parsing or the SDK adapters would
multiply the runtime without testing anything the unit tests do not already pin
down.

**Threshold: the pipeline fails below a mutation score of 80.**

Current score: **85.95%**

| File | Score |
|---|---|
| `config/secrets.ts` | 100% |
| `evaluation/score.ts` | 100% |
| `scraper/url-validation.ts` | 92.2% |
| `scraper/ssrf.ts` | 85.3% |
| `benchmark/run.ts` | 81.0% |
| `evaluation/judge.ts` | 78.3% |

Two documented exclusions, both marked in the source with the reason:

- **the real-DNS adapter** in `ssrf.ts` — every test injects a resolver instead,
  precisely so no test depends on live DNS;
- **the two lookup tables** in `normalize.ts` — they are data, not logic;
  mutating each entry produces hundreds of mutants killable only by asserting
  every word individually.

> Stryker runs through its **command runner**, not
> `@stryker-mutator/vitest-runner`. That runner does not drive Vitest 5
> correctly here — it executes 0 tests per mutant, so every mutant survives no
> matter what the suite asserts, reporting a misleading ~22%. The command runner
> activates mutants through `__STRYKER_ACTIVE_MUTANT__` and is
> version-independent.

---

## Security testing

```bash
npm run test:security
npm run security:audit
```

### SSRF protection

The caller controls the URL, so the fetcher treats it as hostile. Two gates run
before any socket is opened, and **again on every redirect hop**:

1. **Structural validation** — `http:`/`https:` only (so `file:`, `javascript:`,
   `data:`, `ftp:`, `ws:` and the rest are refused), no embedded credentials
   (`https://evil.com@127.0.0.1/` reads one way to a human and another to the
   fetcher), and a 2048-character cap.
2. **Address classification** via `ipaddr.js` — only public unicast passes.
   Loopback, `0.0.0.0`, private ranges, link-local including the cloud metadata
   address `169.254.169.254`, CGNAT, multicast, broadcast, IPv6 unique-local and
   IPv4-mapped IPv6 are all refused. Anything unrecognised fails closed.

Redirects are followed manually with `redirect: 'manual'` precisely so no hop
escapes the check. Fetching is bounded by timeout, redirect count, content type,
and a byte budget enforced **while streaming**, not after buffering.

`SCRAPER_ALLOWED_HOSTS` is the one way a private address becomes reachable. It
is empty by default, matches exact hostnames only (never subdomains), and
relaxes only the address check — scheme, credential and size gates still apply.
Set it only to reach an internal host you own; every name listed becomes a host
callers can reach through your service. The E2E suite uses it to read a local
fixture server.

### Secrets

API keys must never leave the backend process. Tests assert this at every
boundary a key could escape through: the HTTP response, error messages, the
logs, and the source tree. Two specific defences:

- **Provider errors never propagate the SDK's own message** — a vendor error can
  quote the request it failed on. Only the error class name survives.
- **The logger redacts configured credentials.** This was added because the
  secret-exposure suite caught a real leak: pino serialised a raw error message,
  so an SDK error quoting a key would have reached the logs.

### Prompt injection

A page can contain text telling a model to ignore its instructions, and the
fixture `malicious.html` does exactly that. Stripping such text is not possible
in general — instructions are just prose. The defences are that the shared
prompt states the page is untrusted data and delimits it explicitly, and that
**grading never trusts what a model says**: gold answers are read off the page,
so no amount of injection can move a score.

### Malicious HTML

jsdom is constructed without `runScripts`, so nothing in a fetched page ever
executes, and its virtual console is silenced so a malformed page cannot spam
the logs.

### Dependency and secret scanning

`npm run security:audit` runs `npm audit` (failing on high/critical) and
Gitleaks. **When Gitleaks is not installed it reports `NOT RUN — <reason>`
rather than claiming a scan that did not happen.** Install it from
<https://github.com/gitleaks/gitleaks#installing>.

---

## SonarQube

Configuration lives in `sonar-project.properties`, fed by the Vitest coverage
report.

```bash
npm run coverage
npm run quality:sonar
```

When no server is reachable the script prints `NOT RUN — <reason>` plus setup
instructions and exits 0. **It never reports an analysis that did not run.**

```bash
docker run -d --name sonarqube -p 9000:9000 sonarqube:community
export SONAR_HOST_URL=http://localhost:9000
export SONAR_TOKEN=<token from the UI>
npm run quality:sonar
```

Goals: coverage ≥ 80%, duplication ≤ 3%, cognitive complexity ≤ 15, cyclomatic
complexity ≤ 10, technical debt ≤ 5%.

Current coverage: **97.6% overall** (backend 97.9%, frontend 94.9%), verified by
`npm run coverage:verify`, which fails below 80%.

---

## Deploying the backend to Railway

`railway.json` is committed, so Railway picks up the build, start command and
health check automatically.

1. Create a project from this repository:
   ```bash
   railway login
   railway init
   railway up
   ```
   Or, in the dashboard: **New Project → Deploy from GitHub repo**, and leave
   the root directory as the repository root (the build command targets the
   backend workspace).

2. Set the variables under **Variables**:
   ```
   NODE_ENV=production
   FRONTEND_URL=https://<your-app>.vercel.app
   GEMINI_API_KEY=…
   OPENAI_API_KEY=…
   ANTHROPIC_API_KEY=…
   ```
   `PORT` is injected by Railway — do not set it. Omit any key you do not have;
   that provider is simply reported unavailable.

3. Generate a public domain under **Settings → Networking**.

4. Verify: `curl https://<your-service>.up.railway.app/api/health`

`FRONTEND_URL` is the CORS origin. If it does not match the deployed frontend
exactly, the browser will block every request.

---

## Deploying the frontend to Vercel

`vercel.json` is committed with the monorepo build wiring.

1. Import the repository at <https://vercel.com/new>, keeping the root directory
   as the repository root. Or:
   ```bash
   vercel login
   vercel link
   vercel --prod
   ```

2. Set the environment variable **before the first build**:
   ```
   NEXT_PUBLIC_API_URL=https://<your-service>.up.railway.app
   ```

3. Deploy, then set `FRONTEND_URL` on Railway to the resulting Vercel URL and
   redeploy the backend so CORS matches.

> `NEXT_PUBLIC_*` is inlined at build time. Changing `NEXT_PUBLIC_API_URL` has
> no effect until you **redeploy**, not merely restart.

---

## Limitations

Worth knowing before reading anything into a score:

- **The benchmark is small.** Five questions on one page. It measures whether a
  model reports facts that are on the page — not reasoning, synthesis or
  judgement.
- **The default models are not tier-matched**, so the default line-up compares a
  flagship against mid-tier models. Pin comparable models before drawing
  conclusions.
- **The question templates are shallow by design.** Title, byline, first
  heading, a numeric cloze and a term-to-section link. They are reproducible,
  not deep. A model can score well here and still read badly.
- **Grading is string comparison.** It handles case, accents, punctuation,
  digit grouping and simple number words, but a correct answer phrased very
  differently from the page can be scored `INCORRECT`. Every expected answer is
  shown in the UI so you can check.
- **`RELATION` questions depend on the page having headings.** Many pages do
  not, and the question is then `NOT_EVALUABLE`.
- **Extraction is Readability's opinion** of what the main content is. It is
  good, not infallible, and the `strategy` field reports when the fallback ran.
- **Only the first `MAX_CONTENT_CHARS` of a long page reach the models.** The
  result flags `truncated`, but a long page is effectively a test of its
  opening.
- **JavaScript-rendered pages will look empty.** The scraper fetches HTML; it
  does not run a browser.
- **DNS rebinding is not fully closed.** Addresses are validated before the
  fetch, but a hostile resolver could return a different address between the
  check and the connection. Closing this needs the connection pinned to the
  validated IP with a custom dispatcher.
- **Prompt injection is mitigated, not solved.** See
  [Prompt injection](#prompt-injection).
- **Provider latency and rate limits are yours to manage.** Each call is capped
  by `PROVIDER_TIMEOUT_MS`; a timeout is recorded as a provider error and
  excluded from the score.
- **Two moderate advisories remain** in a transitive development dependency
  (`qs`, via Stryker's `typed-rest-client`). Production dependencies report zero
  vulnerabilities at any severity.
- **Results are not stored.** Every run is fresh, and nothing is persisted or
  compared over time.

---

## License

MIT
