/**
 * e2e tests for `data-bascik-server` script blocks.
 *
 * These tests exercise request-time script execution via the Bascik HTTP/2
 * production server.  They require `playwright.server.config.ts` (not the
 * default config) because the static file server used by the rest of the e2e
 * suite cannot execute server scripts.
 *
 * Run with:
 *   npx playwright test --config playwright.server.config.ts
 *
 * The fixture page `src/pages/server-scripts-test.html` contains five server
 * script blocks that:
 *   1. Read a custom request header (`x-test-name`) and output it
 *   2. Read a query parameter (`?color=`) and output it
 *   3. Output the request path
 *   4. Use top-level `await` (async server script)
 *   5. Throw an intentional error to test graceful degradation
 */
import { test, expect } from '@playwright/test';

test.describe('data-bascik-server — request-time script execution', () => {

  // ─── Static baseline ─────────────────────────────────────────────────────

  test('static content before and after server scripts is preserved', async ({ page }) => {
    await page.goto('/server-scripts-test');
    await expect(page.locator('#static-before')).toHaveText('static-before');
    await expect(page.locator('#static-after')).toHaveText('static-after');
  });

  // ─── Request headers ─────────────────────────────────────────────────────

  test('reads a custom request header and injects it into the page', async ({ page }) => {
    await page.setExtraHTTPHeaders({ 'x-test-name': 'Alice' });
    await page.goto('/server-scripts-test');
    await expect(page.locator('#from-header')).toHaveText('Alice');
  });

  test('falls back gracefully when the custom header is absent', async ({ page }) => {
    await page.goto('/server-scripts-test');
    await expect(page.locator('#from-header')).toHaveText('guest');
  });

  // ─── Query parameters ────────────────────────────────────────────────────

  test('reads a query parameter and injects it into the page', async ({ page }) => {
    await page.goto('/server-scripts-test?color=blue');
    await expect(page.locator('#from-query')).toHaveText('blue');
  });

  test('falls back gracefully when the query parameter is absent', async ({ page }) => {
    await page.goto('/server-scripts-test');
    await expect(page.locator('#from-query')).toHaveText('none');
  });

  test('handles multiple query parameters correctly', async ({ page }) => {
    await page.goto('/server-scripts-test?color=red&foo=bar');
    await expect(page.locator('#from-query')).toHaveText('red');
  });

  // ─── Request path ────────────────────────────────────────────────────────

  test('provides the URL path (without query string) to the script', async ({ page }) => {
    await page.goto('/server-scripts-test?color=green');
    await expect(page.locator('#from-path')).toHaveText('/server-scripts-test');
  });

  // ─── Async scripts ───────────────────────────────────────────────────────

  test('supports top-level await in server scripts', async ({ page }) => {
    await page.goto('/server-scripts-test');
    await expect(page.locator('#from-async')).toHaveText('async-ok');
  });

  // ─── Error handling ──────────────────────────────────────────────────────

  test('continues rendering when a server script throws', async ({ page }) => {
    await page.goto('/server-scripts-test');
    // Static bookends must still be present even though one script threw.
    await expect(page.locator('#static-before')).toHaveText('static-before');
    await expect(page.locator('#static-after')).toHaveText('static-after');
  });

  test('removes the erroring script tag (no trace in the DOM)', async ({ page }) => {
    await page.goto('/server-scripts-test');
    // The erroring script had no stdout — its tag slot should be empty.
    // The combined other scripts still render, so the count of <p> elements
    // under <body> is: static-before, from-header, from-query, from-path,
    // from-async, static-after = 6 (not 7, because the error script is gone).
    const ps = await page.locator('body > p').count();
    expect(ps).toBe(6);
  });

  // ─── Per-request freshness ───────────────────────────────────────────────

  test('executes fresh on each request — different headers produce different output', async ({ page }) => {
    await page.setExtraHTTPHeaders({ 'x-test-name': 'Bob' });
    await page.goto('/server-scripts-test');
    await expect(page.locator('#from-header')).toHaveText('Bob');

    await page.setExtraHTTPHeaders({ 'x-test-name': 'Carol' });
    await page.goto('/server-scripts-test');
    await expect(page.locator('#from-header')).toHaveText('Carol');
  });
});
