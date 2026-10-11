import { waitForQuietWindow } from '../support/rate-budget';
import { expect, t, test } from '../support/fixtures';

// Runs last (project "rate-limit"): it exhausts the server's per-client limits on purpose.
test.describe('rate limits', () => {
  test('cart writes over the limit are refused without retries', async ({ app, net, data }) => {
    await waitForQuietWindow('cartWrite');
    await app.page.goto(`/product/${data.plain.id}`);
    const start = Date.now();

    let refusedAt = 0;
    for (let i = 1; i <= 35 && !refusedAt; i++) {
      await expect(app.page.locator('.add-to-cart-btn')).toBeEnabled();
      const [response] = await Promise.all([
        app.page.waitForResponse((r) => r.url().includes('/api/Cart/items') && r.request().method() === 'POST'),
        app.page.locator('.add-to-cart-btn').click(),
      ]);
      if (response.status() === 429) {
        refusedAt = Date.now();
      }
    }

    expect(refusedAt, 'no 429 within 35 writes').toBeGreaterThan(0);
    expect(net.since(start, (e) => e.status === 429)).toHaveLength(1);
    await expect(app.page.locator('.add-to-cart-error')).toContainText(t('apiErrors.tooManyRequests'));
    await app.page.waitForTimeout(1500);
    expect(net.since(refusedAt + 1)).toEqual([]);

    // A quantity change while still limited: a toast, and the quantity stays as it was
    await app.page.goto('/cart');
    const line = app.cartLines.first();
    const before = await line.locator('.qty-value').textContent();
    await line.locator('.qty-btn').first().click();
    await expect(app.toasts.first()).toContainText(t('apiErrors.tooManyRequests'));
    await expect(line.locator('.qty-value')).toHaveText(before!);
  });

  test('more than five login attempts a minute are refused', async ({ app }) => {
    await waitForQuietWindow('auth');
    await app.page.goto('/login');
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      await app.fillLogin({ email: 'nobody-katino-e2e@example.com', password: 'Wrong_pass1' });
      const [response] = await Promise.all([
        app.page.waitForResponse((r) => r.url().includes('/api/CustomerAuth/token')),
        app.page.locator('button[type=submit]').click(),
      ]);
      statuses.push(response.status());
    }

    expect(statuses).toEqual([200, 200, 200, 200, 200, 429]);
    await expect(app.page.locator('.form-error')).toContainText(t('apiErrors.tooManyAttempts'));
  });
});
