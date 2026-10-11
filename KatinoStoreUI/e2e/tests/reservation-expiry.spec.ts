import { Cart, guestCart } from '../support/api';
import { expect, sleep, t, test } from '../support/fixtures';

// These tests wait for real reservations to run out. They need CartOptions.ReservationMinutes = 1 on the
// backend and skip themselves when the hold is longer than two minutes.
const MAX_WAIT_MS = 2 * 60 * 1000;

// When the line's hold ends (epoch ms), from an add response.
function expiresAt(cart: Cart | null, productVariantId: string): number {
  const item = cart?.items.find((i) => i.productVariantId === productVariantId);
  if (!item) {
    throw new Error('The add response has no such cart line');
  }
  return new Date(item.reservationExpiresAt).getTime();
}

test.describe('reservation expiry', () => {
  test('an expired line stays greyed out and can be added again with its quantity', async ({ app, data }) => {
    const plain = data.plain;
    await app.openProduct(plain.id);
    const first = await app.addToCart();
    const firstEnd = expiresAt(first.cart, plain.variants[0].id);
    test.skip(firstEnd - Date.now() > MAX_WAIT_MS, 'Reservation is longer than 2 minutes; set ReservationMinutes to 1');

    await sleep(Math.min(15000, (firstEnd - Date.now()) / 3));
    await app.openProduct(data.other.id);
    await app.addToCart();
    await app.openCart();
    const plainLine = app.line(plain.name);
    const patch = app.waitForPatch();
    await app.clickQuantity(plainLine, 'increase', 1);
    await patch;
    await expect(app.activeLines).toHaveCount(2);

    // The first line's hold ends: it turns grey instead of disappearing, and leaves the totals
    await sleep(firstEnd - Date.now() + 200);
    await expect(plainLine.locator('app-reservation-countdown')).toContainText(t('cart.reservationExpired'));
    await expect(app.expiredLines).toHaveCount(1, { timeout: 10000 });
    const expired = app.expiredLines.first();
    await expect(expired).toContainText(plain.name);
    await expect(expired).toContainText(t('cart.expired'));
    await expect(expired).toContainText(t('cart.pieces', { count: 2 }));
    await expect(expired.locator('.quantity-control')).toHaveCount(0);
    await expect(app.activeLines).toHaveCount(1);
    await expect(app.badge).toHaveText('1');
    const server = await guestCart(await app.guestTokenValue());
    await expect(app.page.locator('.summary-row.total dd')).toHaveText(`${server.totalPrice} ₴`);

    // Added again: back in the cart with the same quantity and a new hold
    const [readd] = await Promise.all([
      app.page.waitForResponse((r) => r.url().includes('/api/Cart/items') && r.request().method() === 'POST'),
      expired.locator('.readd-btn').click(),
    ]);
    expect(readd.request().postDataJSON()).toEqual({ productVariantId: plain.variants[0].id, quantity: 2 });
    await expect(app.expiredLines).toHaveCount(0);
    await expect(app.activeLines).toHaveCount(2);
    await expect(plainLine.locator('.qty-value')).toHaveText('2');
    await expect(plainLine.locator('app-reservation-countdown')).toContainText(t('cart.reservedFor', { time: '' }).trim());
  });

  test('after coming back, the expired line is shown; a reload forgets it', async ({ app, data }) => {
    await app.openProduct(data.plain.id);
    const { cart } = await app.addToCart();
    const left = expiresAt(cart, data.plain.variants[0].id) - Date.now();
    test.skip(left > MAX_WAIT_MS, 'Reservation is longer than 2 minutes; set ReservationMinutes to 1');

    // Leave the app entirely, so no timer refetches meanwhile.
    await app.page.goto('about:blank');
    await sleep(left + 1500);
    await app.openCart();
    await expect(app.expiredLines).toHaveCount(1);
    await expect(app.activeLines).toHaveCount(0);
    await expect(app.page.locator('app-cart-summary')).toHaveCount(0);

    // Still there after moving around the app
    await app.page.locator('a.nav-link[href="/main"]').click();
    await app.page.locator('a.cart-link').click();
    await expect(app.expiredLines).toHaveCount(1);

    // Kept in memory only
    await app.page.reload();
    await expect(app.page.locator('.empty-cart')).toBeVisible();
  });

  test('lines expire while browsing other pages; hiding the grey line sends nothing', async ({ app, net, data }) => {
    await app.openProduct(data.plain.id);
    const { cart } = await app.addToCart();
    const left = expiresAt(cart, data.plain.variants[0].id) - Date.now();
    test.skip(left > MAX_WAIT_MS, 'Reservation is longer than 2 minutes; set ReservationMinutes to 1');
    await expect(app.badge).toHaveText('1');

    // Stay inside the app (no reload): the expiry timer refetches on any page.
    await app.page.locator('a.nav-link[href="/catalog"]').first().click();
    await sleep(left + 2500);
    await expect(app.badge).toBeHidden();

    // The cart page refreshes on open; let that answer arrive before measuring
    await Promise.all([
      app.page.waitForResponse((r) => r.url().endsWith('/api/Cart') && r.request().method() === 'GET'),
      app.page.locator('a.cart-link').click(),
    ]);
    await expect(app.expiredLines).toHaveCount(1);
    const start = Date.now();
    await app.expiredLines.first().locator('.remove-btn').click();
    await expect(app.page.locator('.empty-cart')).toBeVisible();
    await app.page.waitForTimeout(500);
    expect(net.cartCalls(start)).toEqual([]);
  });
});
