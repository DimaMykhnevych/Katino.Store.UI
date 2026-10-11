import { Route } from '@playwright/test';
import { expect, mobile, t, test } from '../support/fixtures';

// Cases the test data can't produce on demand; the API answer is rewritten in the browser.
const fulfillJson = (route: Route, status: number, body: unknown) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

const problem = (field: string, code: string, status: number) => ({ errors: { [field]: [code] }, status });

test.describe('responses the test data cannot produce', () => {
  test('a discontinued variant cannot be added', async ({ app, data }) => {
    const product = data.plain;
    await app.page.route(`**/api/Product/${product.id}`, async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      body.variants[0].status = 3;
      await route.fulfill({ response, json: body });
    });
    await app.openProduct(product.id);

    await expect(app.page.locator('.add-to-cart-btn')).toHaveCount(0);
    await expect(app.page.locator('.variant-unavailable')).toHaveText(t('productDetails.unavailable'));
  });

  test('variantNotPurchasable on add hides the button for that variant', async ({ app, data }) => {
    await app.page.route('**/api/Cart/items', (route) =>
      route.request().method() === 'POST'
        ? fulfillJson(route, 409, problem('productVariantId', 'variantNotPurchasable', 409))
        : route.continue());
    await app.openProduct(data.plain.id);
    await app.page.locator('.add-to-cart-btn').click();

    await expect(app.page.locator('.add-to-cart-error')).toContainText(t('apiErrors.variantNotPurchasable'));
    await expect(app.page.locator('.variant-unavailable')).toBeVisible();
    await expect(app.page.locator('.add-to-cart-btn')).toHaveCount(0);
  });

  test('a line removed from the catalog shows as unavailable with only a remove button', async ({ app, data }) => {
    await app.openProduct(data.plain.id);
    await app.addToCart();
    await app.page.route('**/api/Cart', async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      body.items.push({
        ...body.items[0], id: '00000000-0000-0000-0000-00000000dead', productName: null, article: null,
        size: null, color: null, photoUrl: null, unitPrice: 0, lineTotal: 0, discountAmount: 0, finalLineTotal: 0,
      });
      await route.fulfill({ response, json: body });
    });
    await app.openCart();

    const unavailable = app.cartLines.filter({ hasText: t('cart.unavailable') });
    await expect(unavailable).toHaveCount(1);
    await expect(unavailable.locator('.remove-btn')).toBeVisible();
    await expect(unavailable.locator('.quantity-control, .line-price')).toHaveCount(0);
  });

  test('increasing a discontinued line shows why it failed', async ({ app, data }) => {
    await app.openProduct(data.plain.id);
    await app.addToCart();
    await app.page.route('**/api/Cart/items/*', (route) =>
      route.request().method() === 'PATCH'
        ? fulfillJson(route, 409, problem('productVariantId', 'variantNotPurchasable', 409))
        : route.continue());
    await app.openCart();
    const line = app.line(data.plain.name);
    await app.clickQuantity(line, 'increase', 1);

    await expect(line.locator('.line-error')).toHaveText(t('apiErrors.variantNotPurchasable'));
    await expect(line.locator('.qty-value')).toHaveText('1');
  });

  test('a failed cart load offers a retry', async ({ app, data }) => {
    await app.openProduct(data.plain.id);
    await app.addToCart();
    let fail = true;
    await app.page.route('**/api/Cart', (route) => (fail ? fulfillJson(route, 500, { title: 'boom' }) : route.continue()));
    await app.page.goto('/cart');
    await expect(app.page.locator('.notice-warning')).toContainText(t('cart.loadFailed'));

    fail = false;
    await app.page.locator('.notice-warning button').click();
    await expect(app.line(data.plain.name)).toBeVisible();
    await expect(app.page.locator('.notice-warning')).toHaveCount(0);
  });

  test('opening the cart sends one request', async ({ app, net, data }) => {
    await app.openProduct(data.plain.id);
    await app.addToCart();
    const start = Date.now();
    await app.openCart();
    await app.page.waitForTimeout(1000);

    expect(net.cartCalls(start)).toHaveLength(1);
  });

  test('the cart works in English on a phone', async ({ newSession, data }) => {
    const { app } = await newSession(mobile);
    await app.page.addInitScript(() => localStorage.setItem('language', 'en'));
    await app.openProduct(data.plain.id);
    await app.addToCart();
    await app.openCart();

    await expect(app.page.locator('.cart-title')).toHaveText(t('cart.title', {}, 'en'));
    await expect(app.page.locator('.summary-row.total dt')).toHaveText(t('cart.total', {}, 'en'));
    await expect(app.page.locator('.coming-soon')).toHaveText(t('cart.comingSoon', {}, 'en'));
    await expect(app.page.locator('.continue-btn')).toBeDisabled();
  });
});
