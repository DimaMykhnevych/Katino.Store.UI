import { Cart } from '../support/api';
import { expect, sleep, t, test } from '../support/fixtures';

// These tests wait for real reservations to run out. They need CartOptions.ReservationMinutes = 1 on the
// backend and skip themselves when the hold is longer than two minutes.
const MAX_WAIT_MS = 2 * 60 * 1000;

// When the line's hold ends (epoch ms), from an add response.
function expiresAt(cart: Cart | null, productVariantId?: string): number {
  const item = cart?.items.find((i) => !productVariantId || i.productVariantId === productVariantId);
  if (!item) {
    throw new Error('The add response has no such cart line');
  }
  return new Date(item.reservationExpiresAt).getTime();
}

test.describe('reservation expiry', () => {
  test('lines expire one by one on the open cart page, with a notice', async ({ app, data }) => {
    await app.openProduct(data.plain.id);
    const first = await app.addToCart();
    const firstEnd = expiresAt(first.cart, data.plain.variants[0].id);
    test.skip(firstEnd - Date.now() > MAX_WAIT_MS, 'Reservation is longer than 2 minutes; set ReservationMinutes to 1');

    await sleep(Math.min(15000, (firstEnd - Date.now()) / 3));
    await app.openProduct(data.other.id);
    const second = await app.addToCart();
    const secondEnd = expiresAt(second.cart, data.other.variants[0].id);
    await app.openCart();
    await expect(app.cartLines).toHaveCount(2);

    // The first line goes when its own countdown ends; the cart refetches by itself.
    await sleep(firstEnd - Date.now() + 200);
    await expect(app.line(data.plain.name).locator('app-reservation-countdown')).toContainText(t('cart.reservationExpired'));
    await expect(app.cartLines).toHaveCount(1, { timeout: 10000 });
    await expect(app.line(data.other.name)).toBeVisible();
    await expect(app.page.locator('.notice-info')).toContainText(t('cart.expiredNotice', { count: 1 }));

    await app.page.locator('.notice-info button').click();
    await sleep(secondEnd - Date.now() + 1500);
    await expect(app.page.locator('.empty-cart')).toBeVisible({ timeout: 15000 });
    await expect(app.page.locator('.notice-info')).toContainText(t('cart.expiredNotice', { count: 1 }));
  });

  test('coming back after expiry shows the notice once', async ({ app, data }) => {
    await app.openProduct(data.plain.id);
    const { cart } = await app.addToCart();
    const left = expiresAt(cart, data.plain.variants[0].id) - Date.now();
    test.skip(left > MAX_WAIT_MS, 'Reservation is longer than 2 minutes; set ReservationMinutes to 1');

    // Leave the app entirely, so no timer refetches meanwhile.
    await app.page.goto('about:blank');
    await sleep(left + 1500);
    await app.openCart();
    await expect(app.page.locator('.empty-cart')).toBeVisible();
    await expect(app.page.locator('.notice-info')).toContainText(t('cart.expiredNotice', { count: 1 }));

    await app.page.locator('a.nav-link[href="/main"]').click();
    await app.page.locator('a.cart-link').click();
    await expect(app.page.locator('.cart-title')).toBeVisible();
    await expect(app.page.locator('.notice-info')).toHaveCount(0);
  });

  test('lines expire while browsing other pages; the cart page then shows the notice', async ({ app, data }) => {
    await app.openProduct(data.plain.id);
    const { cart } = await app.addToCart();
    const left = expiresAt(cart, data.plain.variants[0].id) - Date.now();
    test.skip(left > MAX_WAIT_MS, 'Reservation is longer than 2 minutes; set ReservationMinutes to 1');
    await expect(app.badge).toHaveText('1');

    // Stay inside the app (no reload): the expiry timer refetches on any page.
    await app.page.locator('a.nav-link[href="/catalog"]').first().click();
    await sleep(left + 2500);
    await expect(app.badge).toBeHidden();

    await app.page.locator('a.cart-link').click();
    await expect(app.page.locator('.notice-info')).toContainText(t('cart.expiredNotice', { count: 1 }));
  });
});
