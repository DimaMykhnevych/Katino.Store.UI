import {
  Browser,
  BrowserContext,
  BrowserContextOptions,
  expect,
  Locator,
  Page,
  Response,
  test as base,
} from '@playwright/test';
import { Cart, pickTestData, TestData } from './api';
import { Credentials } from './env';
import { record, reserve } from './rate-budget';
import { t } from './i18n';

export const StorageKeys = {
  cartToken: 'katino.cartToken',
  customerToken: 'katino.customerToken',
  customerEmail: 'katino.customerEmail',
};

export interface NetEntry {
  at: number;
  method: string;
  path: string;
  status: number;
  // Whether the identity headers were sent; their values are never kept.
  bearer: boolean;
  guestToken: boolean;
}

// Every API response of a browser context, newest last.
export class NetLog {
  public readonly entries: NetEntry[] = [];

  constructor(context: BrowserContext) {
    context.on('request', (request) => record(request.url(), request.method()));
    context.on('response', (response) => {
      const url = response.url();
      if (!url.includes('/api/')) {
        return;
      }
      const headers = response.request().headers();
      this.entries.push({
        at: Date.now(),
        method: response.request().method(),
        path: url.replace(/^.*\/api/, '').split('?')[0],
        status: response.status(),
        bearer: 'authorization' in headers,
        guestToken: 'x-cart-token' in headers,
      });
    });
  }

  public since(at: number, filter: (e: NetEntry) => boolean = () => true): NetEntry[] {
    return this.entries.filter((e) => e.at >= at && filter(e));
  }

  public cartCalls(at: number): NetEntry[] {
    return this.since(at, (e) => e.path.startsWith('/Cart'));
  }
}

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Page object for the storefront. Actions wait for room in the server's rate limits first.
export class App {
  constructor(public readonly page: Page) {}

  public get cartLines(): Locator {
    return this.page.locator('app-cart-line');
  }

  public get badge(): Locator {
    return this.page.locator('a.cart-link .mat-badge-content');
  }

  public get notices(): Locator {
    return this.page.locator('.notice');
  }

  public get toasts(): Locator {
    return this.page.locator('.toast-container .ngx-toastr');
  }

  public async openProduct(id: string): Promise<void> {
    await reserve({ any: 3 });
    await this.page.goto(`/product/${id}`);
    await expect(this.page.locator('.product-name')).toBeVisible();
  }

  // Presses "Add to cart" and returns the server's answer.
  public async addToCart(): Promise<{ status: number; cart: Cart | null }> {
    await reserve({ cartWrite: 1, any: 2 });
    const [response] = await Promise.all([
      this.page.waitForResponse((r) => r.url().includes('/api/Cart/items') && r.request().method() === 'POST'),
      this.page.locator('.add-to-cart-btn').click(),
    ]);
    // Let the follow-up refetch (after an error) and the UI settle.
    await sleep(300);
    return { status: response.status(), cart: response.ok() ? await response.json() : null };
  }

  public async openCart(): Promise<void> {
    await reserve({ any: 2 });
    await this.page.goto('/cart');
    await expect(this.page.locator('.cart-title')).toBeVisible();
    await expect(this.page.locator('.initial-loading')).toHaveCount(0);
  }

  public line(productName: string): Locator {
    return this.cartLines.filter({ hasText: productName });
  }

  // Clicks "+" or "-" quickly; the cart sends one debounced PATCH afterwards.
  public async clickQuantity(line: Locator, direction: 'increase' | 'decrease', times: number): Promise<void> {
    await reserve({ cartWrite: 1, any: 2 });
    const button = line.locator('.qty-btn').nth(direction === 'increase' ? 1 : 0);
    for (let i = 0; i < times; i++) {
      await button.click();
    }
  }

  public async waitForPatch(): Promise<Response> {
    return this.page.waitForResponse((r) => r.url().includes('/api/Cart/items/') && r.request().method() === 'PATCH');
  }

  public async storage(): Promise<{ cartToken: boolean; customerToken: boolean; email: string | null }> {
    return this.page.evaluate((keys) => ({
      cartToken: !!localStorage.getItem(keys.cartToken),
      customerToken: !!localStorage.getItem(keys.customerToken),
      email: localStorage.getItem(keys.customerEmail),
    }), StorageKeys);
  }

  // Read for server-side comparisons in the test process only; never logged.
  public async guestTokenValue(): Promise<string> {
    const value = await this.page.evaluate((key) => localStorage.getItem(key), StorageKeys.cartToken);
    if (!value) {
      throw new Error('No guest cart token stored');
    }
    return value;
  }

  public async fillLogin(customer: Credentials): Promise<void> {
    await this.page.locator('input[formcontrolname=email]').fill(customer.email);
    await this.page.locator('input[formcontrolname=password]').fill(customer.password);
  }

  // Submits the login form that is already open and returns the server's answer.
  public async submitLogin(): Promise<{ loginErrorCode: number; cartMerged: boolean | null }> {
    await reserve({ auth: 1, any: 3 });
    const [response] = await Promise.all([
      this.page.waitForResponse((r) => r.url().includes('/api/CustomerAuth/token')),
      this.page.locator('button[type=submit]').click(),
    ]);
    await sleep(500);
    if (!response.ok()) {
      throw new Error(`Login request failed with HTTP ${response.status()}`);
    }
    return response.json();
  }

  public async login(customer: Credentials, returnUrl = '/cart'): Promise<void> {
    await this.page.goto(`/login?returnUrl=${encodeURIComponent(returnUrl)}`);
    await this.fillLogin(customer);
    const result = await this.submitLogin();
    expect(result.loginErrorCode, `login of ${customer.email}`).toBe(100);
    await this.page.waitForURL(`**${returnUrl}`);
  }

  public get accountButton(): Locator {
    return this.page.getByRole('button', { name: t('navbar.account') });
  }

  public async logout(): Promise<void> {
    await this.accountButton.click();
    await this.page.locator('.mat-menu-panel').getByText(t('navbar.logout')).click();
  }

  public async setStorage(key: string, value: string | null): Promise<void> {
    await this.page.evaluate(([k, v]) => (v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v)), [key, value] as const);
  }
}

export interface Session {
  context: BrowserContext;
  app: App;
  net: NetLog;
  newTab(): Promise<App>;
}

async function openSession(browser: Browser, options: BrowserContextOptions, baseURL: string | undefined): Promise<Session> {
  const context = await browser.newContext({ ...options, baseURL, ignoreHTTPSErrors: true });
  const net = new NetLog(context);
  const app = new App(await context.newPage());
  return { context, app, net, newTab: async () => new App(await context.newPage()) };
}

export const test = base.extend<
  { net: NetLog; app: App; newSession: (options?: BrowserContextOptions) => Promise<Session> },
  { data: TestData }
>({
  net: async ({ context }, use) => {
    await use(new NetLog(context));
  },
  app: async ({ page, net }, use) => {
    void net; // attaches the log before the first navigation
    await use(new App(page));
  },
  // Extra browser sessions (separate localStorage), closed after the test.
  newSession: async ({ browser, baseURL }, use) => {
    const sessions: Session[] = [];
    await use(async (options = {}) => {
      const session = await openSession(browser, options, baseURL);
      sessions.push(session);
      return session;
    });
    await Promise.all(sessions.map((s) => s.context.close()));
  },
  data: [
    async ({}, use) => {
      await use(await pickTestData());
    },
    { scope: 'worker' },
  ],
});

export { expect, t };

export const mobile: BrowserContextOptions = {
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
};
