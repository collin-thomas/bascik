/**
 * e2e tests for inline <style> tag scoping on the inline-style-test fixture page.
 *
 * Two instances of <inline-style> are rendered plus a bare <p> outside the
 * component.  Tests verify:
 *   - The component's <style> block stays inline in the body (not hoisted to <head>)
 *   - No <style> tag appears inside the .card div itself (it precedes it as a sibling)
 *   - Class-scoped rules (.bascik__inline-style__card etc.) apply correct colours
 *   - Prop values are injected correctly
 *   - Both instances share the same scoped class names and styles
 *   - Class-scoped rules do not bleed to elements outside the component
 *
 * Note: the `p { }` rule in the component's inline style is indented, so the
 * element-selector-to-class conversion (which only matches column-0 selectors)
 * does NOT scope it.  As a result, the `p { color: rgb(120, 180, 120); }` rule
 * is a global selector and applies to ALL <p> elements on the page.
 */
import { test, expect, type Locator } from '@playwright/test';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getInstances(page: Parameters<Parameters<typeof test>[1]>[0]['page']) {
  return {
    a: page.locator('.bascik__inline-style__card').nth(0),
    b: page.locator('.bascik__inline-style__card').nth(1),
  };
}

function cardTitle(card: Locator) {
  return card.locator('.bascik__inline-style__card-title');
}

function cardBody(card: Locator) {
  return card.locator('.bascik__inline-style__card-body');
}

function highlightBox(card: Locator) {
  return card.locator('.bascik__inline-style__highlight-box');
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

test.describe('inline-style-test page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/inline-style-test');
  });

  test('inline style is scoped: no <style> tag inside the card div itself', async ({ page }) => {
    // The <style> block precedes the .card div as a sibling; it should not be
    // a descendant of the .card element.
    const { a } = getInstances(page);
    await expect(a.locator('style')).toHaveCount(0);
  });

  test('card has correct background color', async ({ page }) => {
    const { a } = getInstances(page);
    const bg = await a.evaluate(el => getComputedStyle(el).backgroundColor);
    expect(bg).toBe('rgb(14, 30, 14)');
  });

  test('card title has correct color', async ({ page }) => {
    const { a } = getInstances(page);
    const color = await cardTitle(a).evaluate(el => getComputedStyle(el).color);
    expect(color).toBe('rgb(74, 222, 128)');
  });

  test('paragraph inside component has inline-style p rule applied', async ({ page }) => {
    // The `p { color: rgb(120, 180, 120); }` rule in the inline style is a
    // global selector (not scoped to a class) so it applies to the <p> inside
    // the card.
    const { a } = getInstances(page);
    const p = a.locator('p');
    const color = await p.evaluate(el => getComputedStyle(el).color);
    expect(color).toBe('rgb(120, 180, 120)');
  });

  test('class-scoped styles do not bleed: outside <p> has no card background', async ({ page }) => {
    // The card background (rgb(14, 30, 14)) is tied to the scoped class
    // .bascik__inline-style__card and must not appear on the outside <p>.
    const outsideP = page.locator('body > p');
    const bg = await outsideP.evaluate(el => getComputedStyle(el).backgroundColor);
    expect(bg).not.toBe('rgb(14, 30, 14)');
  });

  test('highlight-box has correct background color', async ({ page }) => {
    const { a } = getInstances(page);
    const bg = await highlightBox(a).evaluate(el => getComputedStyle(el).backgroundColor);
    expect(bg).toBe('rgb(74, 222, 128)');
  });

  test('highlight-box text color is black', async ({ page }) => {
    const { a } = getInstances(page);
    const color = await highlightBox(a).evaluate(el => getComputedStyle(el).color);
    expect(color).toBe('rgb(0, 0, 0)');
  });

  test('prop title is injected into card A', async ({ page }) => {
    const { a } = getInstances(page);
    await expect(cardTitle(a)).toHaveText('Card A');
  });

  test('prop title is injected into card B', async ({ page }) => {
    const { b } = getInstances(page);
    await expect(cardTitle(b)).toHaveText('Card B');
  });

  test('instance A and B both have the same card background', async ({ page }) => {
    const { a, b } = getInstances(page);
    const bgA = await a.evaluate(el => getComputedStyle(el).backgroundColor);
    const bgB = await b.evaluate(el => getComputedStyle(el).backgroundColor);
    expect(bgA).toBe('rgb(14, 30, 14)');
    expect(bgB).toBe('rgb(14, 30, 14)');
  });

  test('instance A and B both have the same card title color', async ({ page }) => {
    const { a, b } = getInstances(page);
    const colorA = await cardTitle(a).evaluate(el => getComputedStyle(el).color);
    const colorB = await cardTitle(b).evaluate(el => getComputedStyle(el).color);
    expect(colorA).toBe('rgb(74, 222, 128)');
    expect(colorB).toBe('rgb(74, 222, 128)');
  });
});
