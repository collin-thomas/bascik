/**
 * e2e tests for sourceURL and component stack trace source attribution.
 */
import { test, expect } from '@playwright/test';

test.describe('source-map-test page', () => {
  test('component runtime error stack trace contains source component path', async ({ page }) => {
    const errors: Error[] = [];
    page.on('pageerror', (err) => errors.push(err));

    await page.goto('/source-map-test');
    await page.getByTestId('trigger-error-btn').click();

    expect(errors.length).toBe(1);
    expect(errors[0].message).toContain('test component error');
    expect(errors[0].stack).toContain('source-map-test');
  });
});
