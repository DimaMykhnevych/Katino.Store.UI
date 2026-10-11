import { guestCart } from '../support/api';
import { expect, sleep, t, test } from '../support/fixtures';

test.describe('guest cart', () => {
  test('a new guest has an empty cart, no token and no cart request', async ({ app, net }) => {
    const start = Date.now();
    await app.openCart();

    await expect(app.page.locator('.empty-cart')).toContainText(t('cart.empty'));
    await expect(app.badge).toBeHidden();
    expect(await app.storage()).toMatchObject({ cartToken: false, customerToken: false });
    expect(net.cartCalls(start)).toEqual([]);
  });

  test('adding a product stores the guest token and shows the line', async ({ app, net, data }) => {
    const product = data.plain;
    const variant = product.variants[0];
    await app.openProduct(product.id);
    const start = Date.now();
    const { status, cart } = await app.addToCart();

    expect(status).toBe(200);
    // The first add carries no identity; the server creates the cart and hands out the token.
    expect(net.cartCalls(start)[0]).toMatchObject({ method: 'POST', bearer: false, guestToken: false });
    expect(await app.storage()).toMatchObject({ cartToken: true, customerToken: false });
    await expect(app.toasts.first()).toContainText(t('productDetails.addedToCart'));
    await expect(app.badge).toHaveText('1');

    await app.openCart();
    const line = app.line(product.name);
    await expect(line).toContainText(variant.color.name);
    await expect(line).toContainText(`${t('cart.size')}: ${variant.size.name}`);
    await expect(line.locator('.price-final')).toHaveText(`${cart!.items[0].finalLineTotal} ₴`);
    await expect(line.locator('app-reservation-countdown')).toContainText(t('cart.reservedFor', { time: '' }).trim());
  });

  test('quick quantity changes send one PATCH and the totals come from the server', async ({ app, net, data }) => {
    await app.openProduct(data.plain.id);
    await app.addToCart();
    await app.openCart();
    const line = app.line(data.plain.name);

    const start = Date.now();
    const patch = app.waitForPatch();
    await app.clickQuantity(line, 'increase', 4);
    await expect(line.locator('.qty-value')).toHaveText('5');
    const request = (await patch).request();
    await sleep(800);

    expect(request.postDataJSON()).toEqual({ quantity: 5 });
    expect(net.since(start, (e) => e.method === 'PATCH')).toHaveLength(1);
    const server = await guestCart(await app.guestTokenValue());
    await expect(app.page.locator('.summary-row.total dd')).toHaveText(`${server.totalPrice} ₴`);
    await expect(line.locator('.price-final')).toHaveText(`${server.items[0].finalLineTotal} ₴`);
  });

  test('more than 10 pieces of one item is refused next to the quantity', async ({ app, data }) => {
    const product = data.plain;
    await app.openProduct(product.id);
    await app.addToCart();
    await app.openCart();
    const line = app.line(product.name);

    let patch = app.waitForPatch();
    await app.clickQuantity(line, 'increase', 9);
    expect((await patch).status()).toBe(200);
    await expect(line.locator('.qty-value')).toHaveText('10');

    patch = app.waitForPatch();
    await app.clickQuantity(line, 'increase', 1);
    expect((await patch).status()).toBe(409);
    await expect(line.locator('.line-error')).toHaveText(t('apiErrors.cartItemLimitExceeded'));
    await expect(line.locator('.qty-value')).toHaveText('10');

    // The same limit from the product page
    await app.openProduct(product.id);
    const { status } = await app.addToCart();
    expect(status).toBe(409);
    await expect(app.page.locator('.add-to-cart-error')).toContainText(t('apiErrors.cartItemLimitExceeded'));
  });

  test('pieces beyond the stock are marked as made to order', async ({ app, data }) => {
    test.skip(!data.lowStock, 'No product whose first variant has fewer than 10 pieces in stock');
    const product = data.lowStock!;
    await app.openProduct(product.id);
    await app.addToCart();
    await app.openCart();
    const line = app.line(product.name);

    const patch = app.waitForPatch();
    await app.clickQuantity(line, 'increase', 9);
    const cart = await (await patch).json();
    const backorder = cart.items[0].backorderQuantity;

    expect(backorder).toBeGreaterThan(0);
    await expect(line.locator('.backorder-note')).toContainText(t('cart.backorder', { count: backorder }));
    await expect(line.locator('.backorder-note')).toContainText(t('productDetails.shippingOnOrder'));
  });

  test('a discounted product shows the old price and the totals match the server', async ({ app, data }) => {
    test.skip(!data.discounted, 'No discounted product in the catalog');
    const product = data.discounted!;
    await app.openProduct(product.id);
    await app.addToCart();
    await app.openCart();

    const server = await guestCart(await app.guestTokenValue());
    const item = server.items[0];
    const line = app.line(product.name);
    expect(item.discountAmount).toBeGreaterThan(0);
    await expect(line.locator('.price-old')).toHaveText(`${item.lineTotal} ₴`);
    await expect(line.locator('.price-final')).toHaveText(`${item.finalLineTotal} ₴`);
    await expect(app.page.locator('.summary-row.discount dd')).toHaveText(`−${server.totalDiscount} ₴`);
    await expect(app.page.locator('.summary-row.total dd')).toHaveText(`${server.totalPrice} ₴`);
  });

  test('removing a line, then removing it again from a stale tab, refetches the cart', async ({ app, net, data, context }) => {
    await app.openProduct(data.plain.id);
    await app.addToCart();
    await app.openCart();
    const stale = await context.newPage();
    await stale.goto('/cart');
    await expect(stale.locator('app-cart-line')).toHaveCount(1);

    await app.page.bringToFront();
    await app.cartLines.first().locator('.remove-btn').click();
    await expect(app.page.locator('.empty-cart')).toBeVisible();

    await stale.bringToFront();
    const start = Date.now();
    await stale.locator('app-cart-line .remove-btn').click();
    await expect(stale.locator('.toast-container .ngx-toastr')).toContainText(t('cart.lineAlreadyRemoved'));
    await expect(stale.locator('.empty-cart')).toBeVisible();
    expect(net.cartCalls(start).map((e) => `${e.method} ${e.status}`)).toEqual(['DELETE 404', 'GET 200']);
  });

  test('a second tab shows the same cart and refetches it on focus', async ({ app, data, context }) => {
    await app.openProduct(data.plain.id);
    await app.addToCart();
    const second = await context.newPage();
    await second.goto('/cart');
    await expect(second.locator('app-cart-line')).toHaveCount(1);

    await app.page.bringToFront();
    await app.openProduct(data.other.id);
    await app.addToCart();
    // The focus refetch is throttled to once per 5 seconds.
    await sleep(5200);
    await second.bringToFront();
    await second.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(second.locator('app-cart-line')).toHaveCount(2);
  });
});
