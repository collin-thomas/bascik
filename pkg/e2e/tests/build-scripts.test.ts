/**
 * e2e tests for `data-bascik-build` script execution.
 *
 * The build-scripts-test fixture page contains four build script blocks:
 *   1. A single-element output
 *   2. A list built from an array
 *   3. A top-level await (async script)
 *   4. An intentional throw — tests that the build survives script failures
 *
 * All four blocks run at build time; the resulting HTML is served statically.
 */
import { test, expect } from '@playwright/test';

test.describe('build-scripts-test page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/build-scripts-test');
  });

  // ─── Static content preservation ─────────────────────────────────────────

  test('static content before build scripts is preserved', async ({ page }) => {
    await expect(page.locator('#static-before')).toHaveText('static-before');
  });

  test('static content after a failing build script is preserved', async ({ page }) => {
    await expect(page.locator('#static-after')).toHaveText('static-after');
  });

  // ─── Script output injection ──────────────────────────────────────────────

  test('single-element build script output is injected into the page', async ({ page }) => {
    await expect(page.locator('#generated-one')).toHaveText('generated-one');
  });

  test('build script that generates a list injects all items', async ({ page }) => {
    await expect(page.locator('#fruit-list li')).toHaveCount(3);
    await expect(page.locator('#fruit-list li').nth(0)).toHaveText('apple');
    await expect(page.locator('#fruit-list li').nth(1)).toHaveText('banana');
    await expect(page.locator('#fruit-list li').nth(2)).toHaveText('cherry');
  });

  test('top-level await works in build scripts', async ({ page }) => {
    await expect(page.locator('#async-result')).toHaveText('async-ok');
  });

  // ─── Error recovery ───────────────────────────────────────────────────────

  test('a throwing build script removes its tag without aborting the build', async ({ page }) => {
    // All static content must still be rendered after the error
    await expect(page.locator('#static-after')).toBeVisible();
    // The raw build-script attribute must not appear anywhere in the output
    const content = await page.content();
    expect(content).not.toContain('data-bascik-build');
  });

  test('page has HTTP 200 status even when a build script throws', async ({ page }) => {
    const response = await page.goto('/build-scripts-test');
    expect(response?.status()).toBe(200);
  });
});
