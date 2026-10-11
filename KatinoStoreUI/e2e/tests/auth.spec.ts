import { env } from '../support/env';
import { expect, mobile, StorageKeys, t, test } from '../support/fixtures';

const needsCustomer = 'Set E2E_CUSTOMER_EMAIL and E2E_CUSTOMER_PASSWORD (a confirmed customer)';

test.describe('registration', () => {
  test('the form is validated on the client without requests', async ({ app, net }) => {
    await app.page.goto('/register');
    const start = Date.now();
    const submit = app.page.locator('button[type=submit]');

    await submit.click();
    await expect(app.page.locator('mat-error')).toHaveText([t('auth.fieldRequired'), t('auth.fieldRequired'), t('auth.fieldRequired')]);

    await app.page.locator('input[formcontrolname=email]').fill('not-an-email');
    await app.page.locator('input[formcontrolname=password]').fill('abc');
    await app.page.locator('input[formcontrolname=confirmPassword]').fill('abd');
    await submit.click();
    await expect(app.page.locator('mat-error')).toHaveText([t('auth.emailInvalid'), t('auth.passwordRules')]);
    await expect(app.page.locator('.mismatch-error')).toHaveText(t('auth.passwordsDoNotMatch'));

    expect(net.since(start)).toEqual([]);
  });

  test('a registered email is reported under the email field', async ({ app }) => {
    test.skip(!env.customer, needsCustomer);
    await app.page.goto('/register');
    await app.page.locator('input[formcontrolname=email]').fill(env.customer!.email);
    await app.page.locator('input[formcontrolname=password]').fill('Katino_e2e1!');
    await app.page.locator('input[formcontrolname=confirmPassword]').fill('Katino_e2e1!');
    const [response] = await Promise.all([
      app.page.waitForResponse((r) => r.url().includes('/CustomerAuth/register')),
      app.page.locator('button[type=submit]').click(),
    ]);

    expect(response.status()).toBe(409);
    await expect(app.page.locator('mat-form-field').first().locator('mat-error')).toHaveText(t('apiErrors.emailAlreadyTaken'));
  });

  test('a new account must confirm its email before logging in', async ({ app }) => {
    test.skip(!env.registerEmail, 'Set E2E_REGISTER_EMAIL (sends a real email; use "{n}" for a unique address)');
    const email = env.registerEmail!.replace('{n}', String(Date.now()));
    const password = `Katino_${Date.now()}!`;

    await app.page.goto('/register');
    await app.page.locator('input[formcontrolname=email]').fill(email);
    await app.page.locator('input[formcontrolname=password]').fill(password);
    await app.page.locator('input[formcontrolname=confirmPassword]').fill(password);
    await app.page.locator('button[type=submit]').click();
    await expect(app.page.locator('.auth-message')).toContainText(t('auth.registeredText', { email }));

    await app.page.goto('/login');
    await app.fillLogin({ email, password });
    const result = await app.submitLogin();

    expect(result.loginErrorCode).toBe(1);
    await expect(app.page.locator('.form-error')).toContainText(t('auth.emailConfirmationRequired'));
    await expect(app.page.locator('.form-error app-support-hint')).toBeVisible();
    expect(await app.storage()).toMatchObject({ customerToken: false });
  });
});

test.describe('email confirmation link', () => {
  test('an incomplete link says so without calling the server', async ({ app, net }) => {
    const start = Date.now();
    await app.page.goto('/emailConfirmation?email=someone%40example.com');

    await expect(app.page.locator('.auth-message')).toContainText(t('auth.confirmationLinkMissing'));
    await expect(app.page).toHaveURL(/\/emailConfirmation$/);
    expect(net.since(start)).toEqual([]);
  });

  test('a wrong token is rejected and removed from the address bar', async ({ app }) => {
    await app.page.goto('/main');
    const [response] = await Promise.all([
      app.page.waitForResponse((r) => r.url().includes('/CustomerAuth/confirm-email')),
      app.page.goto('/emailConfirmation?token=wrong-token&email=someone%40example.com'),
    ]);

    expect(response.status()).toBe(422);
    await expect(app.page.locator('.auth-message')).toContainText(t('auth.confirmationLinkInvalid'));
    await expect(app.page).toHaveURL(/\/emailConfirmation$/);
    await app.page.goBack();
    await expect(app.page).toHaveURL(/\/main$/);
  });

  test('a real link confirms the email once', async ({ app }) => {
    test.skip(!env.confirmLink, 'Set E2E_CONFIRM_LINK to a fresh link from a confirmation email');
    await app.page.goto('/main');
    await Promise.all([
      app.page.waitForResponse((r) => r.url().includes('/CustomerAuth/confirm-email') && r.ok()),
      app.page.goto(env.confirmLink!),
    ]);
    await expect(app.page.locator('.auth-message')).toContainText(t('auth.emailConfirmed'));
    await expect(app.page).toHaveURL(/\/emailConfirmation$/);

    await app.page.goto(env.confirmLink!);
    await expect(app.page.locator('.auth-message')).toContainText(t('auth.confirmationLinkInvalid'));
  });
});

test.describe('login', () => {
  test('a wrong password shows the generic error and stores nothing', async ({ app }) => {
    await app.page.goto('/login');
    await app.fillLogin({ email: env.customer?.email ?? 'nobody-katino-e2e@example.com', password: 'Wrong_pass1' });
    const result = await app.submitLogin();

    expect(result.loginErrorCode).toBe(0);
    await expect(app.page.locator('.form-error')).toContainText(t('auth.invalidCredentials'));
    await expect(app.page.locator('input[formcontrolname=password]')).toHaveValue('');
    expect(await app.storage()).toMatchObject({ customerToken: false });
  });

  test('logging in from the cart moves the guest cart to the customer', async ({ app, net, data }) => {
    test.skip(!env.customer, needsCustomer);
    await app.openProduct(data.plain.id);
    await app.addToCart();
    await app.openCart();

    await app.page.locator('app-cart-summary .login-hint a').click();
    await expect(app.page).toHaveURL(/\/login\?returnUrl=%2Fcart$/);
    await app.fillLogin(env.customer!);
    const start = Date.now();
    const result = await app.submitLogin();
    await app.page.waitForURL('**/cart');

    expect(result.cartMerged).toBe(true);
    expect(await app.storage()).toMatchObject({ cartToken: false, customerToken: true, email: env.customer!.email });
    await expect(app.line(data.plain.name)).toBeVisible();
    await expect(app.accountButton).toBeVisible();
    const [login, ...cartCalls] = net.since(start);
    expect(login).toMatchObject({ path: '/CustomerAuth/token', guestToken: true });
    // One refetch, with the bearer only
    expect(cartCalls).toEqual([expect.objectContaining({ method: 'GET', path: '/Cart', bearer: true, guestToken: false })]);

    // Already logged in: the login page sends you on
    await app.page.goto('/login?returnUrl=%2Fcatalog');
    await app.page.waitForURL('**/catalog');

    await app.openCart();
    await app.logout();
    await expect(app.page.locator('.empty-cart')).toBeVisible();
    expect(await app.storage()).toEqual({ cartToken: false, customerToken: false, email: null });
  });

  test('a failed merge keeps the guest token and tells the user; unsafe returnUrl is ignored', async ({ newSession, data }) => {
    test.skip(!env.customer, needsCustomer);
    const { app } = await newSession(mobile);
    await app.openProduct(data.other.id);
    await app.addToCart();
    // The backend can't be made to fail the merge on demand; rewrite the field instead.
    await app.page.route('**/api/CustomerAuth/token', async (route) => {
      const response = await route.fetch();
      await route.fulfill({ response, json: { ...(await response.json()), cartMerged: false } });
    });

    await app.page.goto('/login?returnUrl=%2F%2Fevil.example.com');
    await app.fillLogin(env.customer!);
    await app.submitLogin();

    await expect(app.page).toHaveURL(/\/main$/);
    await expect(app.toasts.first()).toContainText(t('cart.mergeFailed'));
    expect(await app.storage()).toMatchObject({ cartToken: true, customerToken: true });
    await app.page.locator('a.cart-link').click();
    await expect(app.page.locator('.notice-warning')).toContainText(t('cart.mergeFailed'));

    // Mobile menu: logout with the email, then login
    await app.page.locator('.mobile-toggle').click();
    const logout = app.page.locator('.mobile-menu button.mobile-nav-link');
    await expect(logout).toContainText(t('navbar.logout'));
    await expect(logout).toContainText(env.customer!.email);
    await logout.click();
    expect(await app.page.evaluate((k) => localStorage.getItem(k), StorageKeys.customerToken)).toBeNull();
    await app.page.locator('.mobile-toggle').click();
    await expect(app.page.locator('.mobile-menu')).toContainText(t('navbar.login'));
  });
});
