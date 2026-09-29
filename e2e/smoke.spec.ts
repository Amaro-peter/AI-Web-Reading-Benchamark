import { expect, test } from '@playwright/test';

/** Fast checks that the system is up before the slower scenarios run. */
test.describe('smoke', () => {
  test('the backend reports healthy', async ({ request }) => {
    const response = await request.get('http://127.0.0.1:3101/api/health');
    expect(response.status()).toBe(200);
    expect(await response.json()).toMatchObject({ status: 'ok' });
  });

  test('the frontend loads', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('AI Web Reading Benchmark');
  });

  test('the main endpoint answers with the fixture', async ({ request }) => {
    const response = await request.post('http://127.0.0.1:3101/api/benchmark', {
      data: { url: 'http://127.0.0.1:3102/article' },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.page.title).toBe("Lisbon's tram network turns 150");
    expect(body.questions).toHaveLength(5);
  });
});
