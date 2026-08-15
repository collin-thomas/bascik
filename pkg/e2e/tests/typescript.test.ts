/**
 * e2e tests for TypeScript script support on the ts-script-test fixture page.
 *
 * `data-bascik-ts` marks a <script> as TypeScript. Bascik strips the type
 * annotations at build time (client scripts) or just before Node execution
 * (data-bascik-build scripts), so the browser only ever receives plain
 * JavaScript. Client scripts still flow through the normal scoping pipeline.
 *
 * Tests cover:
 *   - a TS build script (data-bascik-build data-bascik-ts) injects its stdout
 *   - two <ts-counter> instances run independently (per-instance id scoping)
 *   - erasable TS syntax (interface, as-casts, generics, satisfies) executes
 *   - a page-level data-bascik-ts script runs in the browser
 *   - no TypeScript syntax or data-bascik-ts attribute reaches the output
 */
import { test, expect } from '@playwright/test';

test.describe('ts-script-test page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/ts-script-test');
  });

  test('TS build script output is injected into the page', async ({ page }) => {
    await expect(page.locator('#ts-build-result')).toHaveText('ts-build-ok');
  });

  test('two TS counter instances increment independently', async ({ page }) => {
    const counts = page.locator('[id$="__count"]');
    const buttons = page.locator('[id$="__inc"]');
    await expect(counts).toHaveCount(2);

    await buttons.nth(0).click();
    await buttons.nth(0).click();
    await buttons.nth(1).click();

    await expect(counts.nth(0)).toHaveText('2');
    await expect(counts.nth(1)).toHaveText('1');
  });

  test('erasable TS syntax (generics, satisfies, as-casts) executes in the browser', async ({ page }) => {
    const typed = page.locator('[id$="__typed"]');
    await expect(typed.nth(0)).toHaveText('typed-ok');
    await expect(typed.nth(1)).toHaveText('typed-ok');
  });

  test('page-level data-bascik-ts script runs', async ({ page }) => {
    await expect(page.locator('#page-ts-result')).toHaveText('page-ts-ok');
  });

  test('no TypeScript syntax or data-bascik-ts attribute reaches the output HTML', async ({ page }) => {
    const html = await page.content();
    expect(html).not.toContain('data-bascik-ts');
    expect(html).not.toContain('interface CounterState');
    expect(html).not.toContain('as HTMLButtonElement');
    expect(html).not.toContain('satisfies');
  });

  test('surrounding static content renders normally', async ({ page }) => {
    await expect(page.locator('#static-before')).toHaveText('static-before');
    await expect(page.locator('#static-after')).toHaveText('static-after');
  });
});
