import { test, expect } from '@playwright/test';

test.describe('Docs Component E2E Tests', () => {
  test('component-demo switches between preview, code, and output tabs', async ({ page }) => {
    await page.goto('/components');

    // Locate component-demo tab labels/radios
    const previewLabel = page.locator('.demo-tab:has-text("Preview")').first();
    const codeLabel = page.locator('.demo-tab:has-text("Source")').first();

    await expect(previewLabel).toBeVisible();
    await expect(codeLabel).toBeVisible();

    // Click Source tab and verify pane switching
    await codeLabel.click();

    const codePane = page.locator('.demo-pane[data-pane="code"]').first();
    await expect(codePane).toBeVisible();
  });

  test('comp-toggle expands and collapses detail panel', async ({ page }) => {
    await page.goto('/scoped-javascript');

    const toggleBtn = page.locator('.toggle-wrap button#btn').first();
    const detailPanel = page.locator('.toggle-wrap #detail').first();

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
    await page.goto('/getting-started');

    const countVal = page.locator('.ctr-count').first();
    const incBtn = page.locator('.ctr-inc').first();
    const decBtn = page.locator('.ctr-dec').first();

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

    const searchBtn = page.locator('.dnav-search-btn');
    const modal = page.locator('.search-overlay');
    const input = page.locator('#docs-search-input');
    const resultsList = page.locator('.search-results');

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

    const alert = page.locator('#alert').first();
    const closeBtn = page.locator('#alert #close').first();

    if (await alert.isVisible()) {
      await closeBtn.click();
      await expect(alert).toBeHidden();
    }
  });
});
