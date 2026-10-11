import { clearCustomerCart } from '../support/api';
import { env } from '../support/env';
import { App, expect, test } from '../support/fixtures';

async function accountEmail(app: App): Promise<string | null> {
  await app.accountButton.click();
  const email = await app.page.locator('.account-email').textContent();
  await app.page.keyboard.press('Escape');
  return email?.trim() ?? null;
}

test.describe('several tabs', () => {
  test('logging in and out in one tab is mirrored in the other', async ({ newSession }) => {
    test.skip(!env.customer, 'Set E2E_CUSTOMER_EMAIL and E2E_CUSTOMER_PASSWORD (a confirmed customer)');
    const session = await newSession();
    const a = session.app;
    const b = await session.newTab();
    await a.openCart();

    await b.login(env.customer!);
    await expect(a.accountButton).toBeVisible();
    expect(await accountEmail(a)).toBe(env.customer!.email);

    await b.logout();
    await expect(a.page.locator('a.login-link')).toBeVisible();
    await expect(a.page.locator('.empty-cart')).toBeVisible();
  });

  test('logging in as another customer in a second tab reloads this tab\'s cart', async ({ newSession, data }) => {
    test.skip(!env.customer || !env.secondCustomer, 'Set E2E_CUSTOMER_* and E2E_SECOND_CUSTOMER_* (two confirmed customers)');
    const session = await newSession();
    const a = session.app;
    const b = await session.newTab();
    // The first customer's cart is empty, the second one's gets a product: the carts differ.
    await clearCustomerCart(env.customer!);
    // B shows the login form before A logs in, so it is not redirected away later.
    await b.page.goto('/login');

    await a.login(env.secondCustomer!);
    await a.openProduct(data.plain.id);
    await a.addToCart();
    await a.openCart();
    await expect(a.line(data.plain.name)).toBeVisible();

    await b.fillLogin(env.customer!);
    await b.submitLogin();

    // A now shows the first customer, with that customer's (empty) cart, not the previous one's
    expect(await accountEmail(a)).toBe(env.customer!.email);
    await expect(a.page.locator('.empty-cart')).toBeVisible();
    await expect(a.cartLines).toHaveCount(0);
  });
});
