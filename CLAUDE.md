# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository state

This repo currently contains **only `README.md`, and that README is not documentation — it is the project specification** (written in Portuguese) for an MVP that has not been implemented yet. There are no commits on `main`, no source, no `package.json`.

Two consequences:

- The commands below do not exist yet. They are the contract the spec requires; create them with the names given (§24 of the spec lists the exact script names), don't invent alternatives.
- When implementation starts, `README.md` must be **replaced** by real documentation (the spec dictates its required sections in §30). Keep a copy of the spec elsewhere if it's still needed as a reference.

## What is being built

`POST /api/benchmark` takes a URL, fetches and extracts the page's main content, asks ~5 fixed questions about it, sends the same content+question to Gemini / OpenAI / Anthropic in parallel, evaluates the answers, and returns everything side by side. A single-page Next.js frontend drives it.

The framing matters and is load-bearing in the product copy: this is an **experimental** benchmark whose results depend on the page, the questions, the models, and the evaluation method. No editorial ranking of models, no presenting scores as truth.

## Intended architecture

```
/
  frontend/   Next.js + TypeScript + Tailwind, single page, Vitest + RTL + Playwright
  backend/    Fastify + TypeScript, Zod validation, Vitest + fastify.inject
  package.json  (monorepo root; `npm run ci` and the per-stage scripts live here)
```

Backend layering the spec calls for:

- **scraper** — URL validation → SSRF guard → fetch (timeout + size cap) → main-content extraction via a mature Readability-style library. Never hand-roll an HTML parser.
- **providers** — one `AIProvider` interface (`name`, `model`, `answer({ pageContent, question })`), implemented by `GeminiProvider` / `OpenAIProvider` / `ClaudeProvider` over the official SDKs, plus mock providers for tests. Model IDs live in one central config.
- **benchmark** — question set across three categories: `EXTRACTION`, `COMPREHENSION`, `RELATION`. Fixed questions, not an auto-generation engine. Reproducibility beats sophistication.
- **evaluation/** — an *independent* layer taking `question`, `expectedAnswer`, `actualAnswer` → `CORRECT` (1) / `PARTIAL` (0.5) / `INCORRECT` (0) / `NOT_EVALUABLE`. If an LLM-as-a-judge is needed for open questions, isolate it behind a swappable interface and test it with mocks only.

Request flow the integration tests must exercise end to end: HTTP → validation → scraping → benchmark → providers → evaluation → response.

## Non-negotiable constraints from the spec

- **TypeScript strict** everywhere; avoid `any` when there's a reasonable alternative.
- **No API key may reach the frontend.** Secrets never in `NEXT_PUBLIC_*`. There are explicit tests asserting keys appear in no HTML, no JSON response, no frontend bundle, no log.
- **A missing API key must not break the benchmark** — mark that provider `unavailable` and run the others. Provider calls run in parallel.
- **SSRF protection is explicit**, not assumed from a library: block localhost, `127.0.0.1`, `::1`, `0.0.0.0`, private ranges, `file://`, `javascript:`, `data:`, and any non-HTTP(S) scheme. Validate *before* fetch and re-check on redirect — don't follow a redirect into a blocked destination. Dedicated SSRF tests are required.
- **Never call real AI APIs from tests.** Only the opt-in `npm run test:live` may, and it must demand explicit env vars, warn about cost, and stay out of CI.
- **Tests are written with the feature, not after it.** Per the spec's closing principle: define behavior → write the test → implement → run → refactor → run quality gates. A component isn't done until its tests exist and pass.
- **Never report a tool as passing when it didn't run.** Say `NOT RUN — <reason>` instead. This applies to CI summaries and to anything reported back to the user.

## Commands (to be created with these exact names)

| Command | Purpose |
|---|---|
| `npm run dev` | local development |
| `npm run build` | build frontend + backend; must pass before "done" |
| `npm run typecheck` | TypeScript, zero errors accepted |
| `npm run lint` | ESLint (TS + Next.js); no unused vars, no invalid imports |
| `npm run format:check` | Prettier |
| `npm run dead-code` | Knip; pipeline fails on clearly dead code |
| `npm run test:unit` | fast, deterministic, all I/O mocked |
| `npm run test:integration` | `fastify.inject` against the real route wiring |
| `npm run test:regression` | runs against fixed HTML fixtures (e.g. `tests/fixtures/article.html`) |
| `npm run test:spec` | requirements as executable specifications |
| `npm run test:security` | SSRF, invalid/oversized input, malformed & malicious HTML, prompt-injection awareness, secret exposure |
| `npm run test:smoke` | backend boots, `/api/health` 200, frontend loads, main endpoint answers under mocks |
| `npm run test:mutation` | StrykerJS; fails below the documented threshold |
| `npm run test:e2e` | Playwright, mocked providers |
| `npm run test:live` | manual only, real APIs, costs money, never in CI |
| `npm run security:audit` | `npm audit` + secret scanning (Gitleaks) |
| `npm run quality:sonar` | SonarQube when a local server is available; otherwise print setup instructions — never fake a run |
| `npm run ci` | full pipeline, in order, stops on first required failure, non-zero exit |

`npm run ci` ordering: clean → deps → typecheck → lint → format:check → dead-code → unit → integration → regression → spec → security → smoke → mutation → build → e2e → coverage → sonar (when available). Smoke tests run before the slow suites.

Running a single test: `npx vitest run path/to/file.test.ts -t "test name"` from the relevant workspace.

## Quality gates

Coverage ≥ 80%, duplication ≤ 3%, cognitive complexity ≤ 15, cyclomatic complexity ≤ 10, technical debt ≤ 5%. Requires `sonar-project.properties` fed by Vitest coverage. Refactor to meet these; don't add artificial structure just to move a metric.

A Husky `pre-push` hook runs `npm run ci` and blocks the push on failure. `git push --no-verify` is explicitly outside the project's normal flow.

## Environment variables

Backend (`backend/.env.example`): `PORT`, `FRONTEND_URL`, `GEMINI_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`.
Frontend (`frontend/.env.example`): `NEXT_PUBLIC_API_URL` only.

Deploy targets: backend → Railway, frontend → Vercel.

## Commits

Small, semantically scoped, conventional-style (`feat:`, `test:`, `chore:`). Avoid one giant commit.
