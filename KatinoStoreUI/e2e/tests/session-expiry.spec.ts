import { jwtExpiresAt } from '../support/api';
import { env } from '../support/env';
import { expect, sleep, StorageKeys, t, test } from '../support/fixtures';

// Expired or rejected customer tokens: the user is shown as logged out with an empty cart and a login
// prompt, and the app never falls back to the guest cart on its own.
const MAX_WAIT_MS = 2 * 60 * 1000;

test.describe('customer session expiry', () => {
  test('a token that expires on the cart page: banner, empty cart, then guest on an explicit add', async ({ app, net, data }) => {
    test.skip(!env.customer, 'Set E2E_CUSTOMER_EMAIL and E2E_CUSTOMER_PASSWORD (a confirmed customer)');
    await app.login(env.customer!);
    const token = await app.page.evaluate((k) => localStorage.getItem(k)!, StorageKeys.customerToken);
    const expiresAt = jwtExpiresAt(token);
    test.skip(expiresAt - Date.now() > MAX_WAIT_MS, 'Customer token lives longer than 2 minutes; shorten it on the backend');

    await sleep(expiresAt - Date.now() + 1000);
    const start = Date.now();
    // Coming back to the tab checks the token (a cart refetch with it would get 401 as well).
    await app.page.evaluate(() => window.dispatchEvent(new Event('focus')));

    await expect(app.page.locator('.notice-warning')).toContainText(t('cart.sessionExpired'));
    await expect(app.page.locator('.empty-cart')).toBeVisible();
    await expect(app.page.locator('a.login-link')).toBeVisible();
    expect(await app.storage()).toMatchObject({ customerToken: false, email: null });
    expect(net.cartCalls(start).filter((e) => e.guestToken)).toEqual([]);

    // Adding a product now is an explicit choice to continue as a guest.
    await app.openProduct(data.other.id);
    const added = Date.now();
    const { status } = await app.addToCart();
    expect(status).toBe(200);
    expect(net.cartCalls(added)[0]).toMatchObject({ method: 'POST', bearer: false });
    await app.page.locator('a.cart-link').click();
    await expect(app.line(data.other.name)).toBeVisible();
    await expect(app.page.locator('.notice-warning')).toHaveCount(0);
  });

  test('a rejected bearer (401) does not show the guest cart instead', async ({ app, net, data }) => {
    await app.openProduct(data.plain.id);
    await app.addToCart();
    await app.setStorage(StorageKeys.customerToken, 'made.up.token');
    const start = Date.now();
    await app.openCart();

    await expect(app.page.locator('.notice-warning')).toContainText(t('cart.sessionExpired'));
    await expect(app.page.locator('.empty-cart')).toBeVisible();
    expect(await app.storage()).toMatchObject({ cartToken: true, customerToken: false });
    // One cart call, with the bearer, answered 401; no retry with the guest token
    expect(net.cartCalls(start).map((e) => [e.method, e.status, e.bearer, e.guestToken])).toEqual([['GET', 401, true, false]]);
  });

  test('a token already expired when the app starts is dropped without a request', async ({ app, net }) => {
    await app.page.goto('/main');
    await app.page.evaluate((key) => {
      const part = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, '');
      localStorage.setItem(key, `${part({ alg: 'none' })}.${part({ exp: Math.floor(Date.now() / 1000) - 30 })}.sig`);
    }, StorageKeys.customerToken);
    const start = Date.now();
    await app.openCart();

    await expect(app.page.locator('.notice-warning')).toContainText(t('cart.sessionExpired'));
    expect(await app.storage()).toMatchObject({ customerToken: false });
    expect(net.cartCalls(start)).toEqual([]);
  });
});
