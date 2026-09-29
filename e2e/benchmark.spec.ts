import { expect, test } from '@playwright/test';
import { FIXTURE_ORIGIN } from '../playwright.config';

const ARTICLE_URL = `${FIXTURE_ORIGIN}/article`;

/**
 * Browser -> Next.js -> Fastify -> mock providers -> rendered result.
 *
 * No real AI API and no real website are involved: the backend runs with
 * AI_PROVIDER_MODE=mock and scrapes a local fixture server.
 */

async function runBenchmark(page: import('@playwright/test').Page, url: string) {
  await page.goto('/');
  await page.getByLabel('Page URL').fill(url);
  await page.getByRole('button', { name: 'Run Benchmark' }).click();
}

test.describe('the main scenario', () => {
  test('a user benchmarks a page and sees every model scored', async ({ page }) => {
    await page.goto('/');

    // 1. the application opens
    await expect(
      page.getByRole('heading', { level: 1, name: 'AI Web Reading Benchmark' }),
    ).toBeVisible();
    await expect(page.getByText(/Experimental benchmark/)).toBeVisible();

    // 2. the user enters a URL and 3. runs the benchmark
    await page.getByLabel('Page URL').fill(ARTICLE_URL);
    await page.getByRole('button', { name: 'Run Benchmark' }).click();

    // 4. the result arrives
    await expect(page.getByRole('heading', { name: 'Results' })).toBeVisible();

    // the page it actually read
    await expect(page.getByText("Lisbon's tram network turns 150").first()).toBeVisible();
    await expect(page.getByText('428')).toBeVisible();

    // 5, 6, 7. each provider is reported
    for (const label of ['Gemini', 'ChatGPT', 'Claude']) {
      await expect(page.getByRole('article', { name: label })).toBeVisible();
    }

    // 8. scores are shown
    const gemini = page.getByRole('article', { name: 'Gemini' });
    await expect(gemini.getByText('Extraction')).toBeVisible();
    await expect(gemini.getByText('Comprehension')).toBeVisible();
    await expect(gemini.getByText('Relation')).toBeVisible();
    await expect(gemini.getByText(/%|n\/a/).first()).toBeVisible();
  });

  test('every question appears with all three model answers', async ({ page }) => {
    await runBenchmark(page, ARTICLE_URL);
    await expect(page.getByRole('heading', { name: 'Results' })).toBeVisible();

    const table = page.getByRole('table');
    await expect(table).toBeVisible();

    const headers = await table.getByRole('columnheader').allTextContents();
    expect(headers).toEqual(['Question', 'Gemini', 'ChatGPT', 'Claude']);

    // header row + five questions
    await expect(table.getByRole('row')).toHaveCount(6);
    await expect(table.getByText('EXTRACTION').first()).toBeVisible();
    await expect(table.getByText('COMPREHENSION').first()).toBeVisible();
    await expect(table.getByText('RELATION').first()).toBeVisible();
  });

  test('the expected answer is shown so the grading can be checked', async ({ page }) => {
    await runBenchmark(page, ARTICLE_URL);
    await expect(page.getByRole('heading', { name: 'Results' })).toBeVisible();
    await expect(page.getByText('Expected:').first()).toBeVisible();
    await expect(page.getByText('Marta Ribeiro').first()).toBeVisible();
  });

  test('progress is shown while the run is in flight', async ({ page }) => {
    await page.goto('/');
    // Hold the response open so the in-flight state is observable.
    await page.route('**/api/benchmark', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await route.continue();
    });

    await page.getByLabel('Page URL').fill(ARTICLE_URL);
    await page.getByRole('button', { name: 'Run Benchmark' }).click();

    await expect(page.getByText('Benchmark in progress')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Running…' })).toBeDisabled();
    await expect(page.getByRole('heading', { name: 'Results' })).toBeVisible();
  });

  test('a redirect is followed and the final URL is reported', async ({ page }) => {
    await runBenchmark(page, `${FIXTURE_ORIGIN}/redirects-to-article`);
    await expect(page.getByRole('heading', { name: 'Results' })).toBeVisible();
    await expect(page.getByText(/redirected from/)).toBeVisible();
  });
});

test.describe('error handling', () => {
  test('an invalid URL is reported without leaving the page broken', async ({ page }) => {
    await page.goto('/');
    // type="url" blocks obvious nonsense in the browser, so use a
    // well-formed URL the backend refuses.
    await page.getByLabel('Page URL').fill('ftp://example.com/file.txt');
    await page.getByRole('button', { name: 'Run Benchmark' }).click();

    const alert = page.getByRole('alert', { name: 'The benchmark could not run' });
    await expect(alert).toBeVisible();
    await expect(alert).toContainText('UNSUPPORTED_SCHEME');
    await expect(page.getByRole('button', { name: 'Run Benchmark' })).toBeEnabled();
  });

  test('a blocked private address is refused', async ({ page }) => {
    await runBenchmark(page, 'http://169.254.169.254/latest/meta-data/');
    const alert = page.getByRole('alert', { name: 'The benchmark could not run' });
    await expect(alert).toBeVisible();
    await expect(alert).toContainText('BLOCKED_HOST');
  });

  test('a backend failure is reported to the user', async ({ page }) => {
    await runBenchmark(page, `${FIXTURE_ORIGIN}/boom`);
    await expect(page.getByRole('alert', { name: 'The benchmark could not run' })).toContainText(
      'HTTP_ERROR',
    );
  });

  test('a page with no readable content is reported', async ({ page }) => {
    await runBenchmark(page, `${FIXTURE_ORIGIN}/empty`);
    await expect(page.getByRole('alert', { name: 'The benchmark could not run' })).toContainText(
      'EMPTY_CONTENT',
    );
  });

  test('the browser blocks an empty submission before it reaches the backend', async ({ page }) => {
    await page.goto('/');
    let called = false;
    await page.route('**/api/benchmark', async (route) => {
      called = true;
      await route.abort();
    });

    await page.getByRole('button', { name: 'Run Benchmark' }).click();
    await page.waitForTimeout(500);

    expect(called).toBe(false);
    await expect(page.getByRole('heading', { name: 'Results' })).toBeHidden();
  });
});

test.describe('provider availability', () => {
  test('an unavailable provider is explained, and the others still run', async ({ page }) => {
    // The mock line-up has all three available, so simulate one missing key
    // by rewriting the response the browser receives.
    await page.route('**/api/benchmark', async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      body.results.claude = {
        ...body.results.claude,
        status: 'unavailable',
        reason: 'ANTHROPIC_API_KEY is not configured.',
        answers: [],
        scores: null,
      };
      await route.fulfill({ response, json: body });
    });

    await runBenchmark(page, ARTICLE_URL);
    await expect(page.getByRole('heading', { name: 'Results' })).toBeVisible();

    const claude = page.getByRole('article', { name: 'Claude' });
    await expect(claude.getByText('Not run')).toBeVisible();
    await expect(claude.getByText(/ANTHROPIC_API_KEY is not configured/)).toBeVisible();

    // the other two still produced answers
    await expect(page.getByRole('article', { name: 'Gemini' })).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();
  });
});

test.describe('secrets', () => {
  test('no API key appears anywhere in what the browser receives', async ({ page }) => {
    const payloads: string[] = [];
    page.on('response', (response) => {
      void response
        .text()
        .then((text) => payloads.push(text))
        .catch(() => undefined);
    });

    await runBenchmark(page, ARTICLE_URL);
    await expect(page.getByRole('heading', { name: 'Results' })).toBeVisible();

    const everything = payloads.join('\n') + (await page.content());
    expect(everything).not.toMatch(/\bsk-[A-Za-z0-9-]{16,}/);
    expect(everything).not.toMatch(/\bAIza[A-Za-z0-9_-]{20,}/);
    for (const name of ['GEMINI_API_KEY=', 'OPENAI_API_KEY=', 'ANTHROPIC_API_KEY=']) {
      expect(everything).not.toContain(name);
    }
  });
});
