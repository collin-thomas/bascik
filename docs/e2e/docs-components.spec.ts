import { test, expect } from '@playwright/test';

test.describe('Docs Component E2E Tests', () => {
  test('component-demo switches between preview, code, and output tabs', async ({ page }) => {
    await page.goto('/components');

    // Locate component-demo tab labels/radios
    const previewLabel = page.locator('label', { hasText: 'Preview' }).first();
    const codeLabel = page.locator('label', { hasText: 'Source' }).first();

    await expect(previewLabel).toBeVisible();
    await expect(codeLabel).toBeVisible();

    // Click Source tab and verify pane switching
    await codeLabel.click();

    const codePane = page.locator('[data-pane="code"]').first();
    await expect(codePane).toBeVisible();
  });

  test('comp-toggle expands and collapses detail panel', async ({ page }) => {
    await page.goto('/components');

    const toggleBtn = page.getByRole('button', { name: /Read more|Show less/ }).first();
    const detailPanel = page.locator('p:has-text("No JavaScript is added to the page")').locator('..');

    await expect(detailPanel).toBeHidden();
    await expect(toggleBtn).toHaveText('Read more');

    // Click toggle button to expand
    await toggleBtn.click();
    await expect(detailPanel).toBeVisible();
    await expect(toggleBtn).toHaveText('Show less');

    // Click again to collapse
    await toggleBtn.click();
    await expect(detailPanel).toBeHidden();
    await expect(toggleBtn).toHaveText('Read more');
  });

  test('demo-counter increments and decrements count', async ({ page }) => {
    await page.goto('/scoped-javascript');

    const incBtn = page.locator('button:has-text("+")').first();
    const decBtn = page.locator('button:has-text("−")').first();
    const countVal = incBtn.locator('../..').locator('span').nth(1);

    await expect(countVal).toHaveText('0');

    // Increment
    await incBtn.click();
    await expect(countVal).toHaveText('1');

    await incBtn.click();
    await expect(countVal).toHaveText('2');

    // Decrement
    await decBtn.click();
    await expect(countVal).toHaveText('1');
  });

  test('docs-search modal opens, filters results on typing, and closes on Escape', async ({ page }) => {
    await page.goto('/');

    const searchBtn = page.getByRole('button', { name: 'Search docs' }).first();
    const modal = page.getByRole('dialog', { name: 'Search documentation' }).locator('..');
    const input = page.getByPlaceholder('Search docs…');
    const resultsList = page.getByRole('listbox', { name: 'Search results' });

    await expect(modal).toBeHidden();

    // Open search modal via button click
    await searchBtn.click();
    await expect(modal).toBeVisible();
    await expect(input).toBeFocused();

    // Type query
    await input.fill('scoped styles');

    // Verify search results populate
    const resultItem = resultsList.locator('li').first();
    await expect(resultItem).toBeVisible();
    await expect(resultItem).toContainText('Scoped Styles');

    // Close modal via Escape key
    await page.keyboard.press('Escape');
    await expect(modal).toBeHidden();
  });

  test('comp-alert dismisses when clicking close button', async ({ page }) => {
    await page.goto('/components');

    const closeBtn = page.getByRole('button', { name: 'Dismiss' }).first();
    const alert = closeBtn.locator('..');

    if (await closeBtn.isVisible()) {
      await closeBtn.click();
      await expect(alert).toBeHidden();
    }
  });
});
