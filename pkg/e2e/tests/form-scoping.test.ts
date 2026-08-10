/**
 * e2e tests for form `name` attribute scoping on the form-test fixture page.
 *
 * Two instances of <form-test> are rendered side by side. Tests verify:
 *   - Input/select `name` attributes are scoped per-instance
 *   - `new FormData(form)` entries use the scoped names as keys
 *   - The two instances produce distinct scoped names (different hash segments)
 *   - Clicking a button in one instance does not mutate the other instance's result
 *   - The in-component `getElementById` calls are also rewritten to scoped names
 *
 * The fixture is built with `obfuscateAttributeNames: false` so readable scoped
 * names like `bascik__form-test__9c332cac__username` appear in the DOM.
 */
import { test, expect, type Locator } from '@playwright/test';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getInstances(page: Parameters<Parameters<typeof test>[1]>[0]['page']) {
  return {
    a: page.locator('.bascik__form-test__form').nth(0),
    b: page.locator('.bascik__form-test__form').nth(1),
  };
}

const result = (inst: Locator) => inst.locator('[id$="__result"]');
const btn = (inst: Locator, suffix: string) => inst.locator(`[id$="__${suffix}"]`);

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

test.describe('form-test page — name attribute scoping', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/form-test');
  });

  // ── 1. username input has a scoped name attribute ───────────────────────

  test('username input has scoped name attribute', async ({ page }) => {
    const { a } = getInstances(page);
    const usernameInput = a.locator('[id$="__username-input"]');
    await expect(usernameInput).toHaveAttribute('name', /bascik__form-test__.+__username/);
  });

  // ── 2. email input has a scoped name attribute ──────────────────────────

  test('email input has scoped name attribute', async ({ page }) => {
    const { a } = getInstances(page);
    const emailInput = a.locator('[id$="__email-input"]');
    await expect(emailInput).toHaveAttribute('name', /bascik__form-test__.+__email/);
  });

  // ── 3. role select has a scoped name attribute ──────────────────────────

  test('role select has scoped name attribute', async ({ page }) => {
    const { a } = getInstances(page);
    const roleSelect = a.locator('[id$="__role-select"]');
    await expect(roleSelect).toHaveAttribute('name', /bascik__form-test__.+__role/);
  });

  // ── 4. FormData keys contain the scoped name prefix ─────────────────────
  //
  // Clicking "Read FormData" runs `new FormData(form)` inside the component's
  // scoped script, then joins the entry keys into the result div. Because name
  // attributes are scoped, FormData uses the scoped names as keys.

  test('FormData keys use scoped names (contain bascik__form-test__ prefix)', async ({ page }) => {
    const { a } = getInstances(page);
    await btn(a, 'submit-btn').click();
    await expect(result(a)).toHaveText(/keys: bascik__form-test__.+__username/);
  });

  // ── 5. FormData has exactly 3 entries ───────────────────────────────────

  test('FormData has exactly 3 entries (username, email, role)', async ({ page }) => {
    const { a } = getInstances(page);
    await btn(a, 'check-entries-btn').click();
    await expect(result(a)).toHaveText('count: 3');
  });

  // ── 6. both instances have different name scopes (different hashes) ─────
  //
  // Each instance gets a unique hash segment. The scoped names for instance A
  // and instance B must differ so FormData from both forms doesn't collide.

  test('both instances have different scoped name attributes for username', async ({ page }) => {
    const inputs = page.locator('[id$="__username-input"]');
    const nameA = await inputs.nth(0).getAttribute('name');
    const nameB = await inputs.nth(1).getAttribute('name');
    expect(nameA).toMatch(/bascik__form-test__.+__username/);
    expect(nameB).toMatch(/bascik__form-test__.+__username/);
    expect(nameA).not.toBe(nameB);
  });

  // ── 7. clicking submit in A does not affect B's result ──────────────────

  test('clicking submit in instance A does not update instance B result', async ({ page }) => {
    const { a, b } = getInstances(page);
    await btn(a, 'submit-btn').click();
    await expect(result(a)).toHaveText(/keys:/);
    await expect(result(b)).toHaveText('No submission yet');
  });
});
