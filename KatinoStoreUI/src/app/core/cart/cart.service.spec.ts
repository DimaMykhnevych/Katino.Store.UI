import { HTTP_INTERCEPTORS } from '@angular/common/http';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { ToastrService } from 'ngx-toastr';
import { AppSettings } from '../settings';
import { StorageKeys } from '../constants/storage-keys';
import { Cart } from '../models/cart/cart';
import { CartItem } from '../models/cart/cart-item';
import { CartAuthInterceptor } from '../auth/services/cart-auth.interceptor';
import { CustomerAuthService } from '../auth/services/customer-auth.service';
import { CartService, CartState } from './cart.service';

const cartUrl = `${AppSettings.apiHost}/Cart`;

function item(id: string, quantity = 1, overrides: Partial<CartItem> = {}): CartItem {
  return {
    id,
    productVariantId: `v-${id}`,
    productId: `p-${id}`,
    productName: 'Emmi',
    article: 'A-1',
    size: { id: 's', name: 'S' },
    color: { id: 'c', name: 'Red', hexCode: '#f00' },
    photoUrl: null,
    quantity,
    unitPrice: 100,
    lineTotal: 100 * quantity,
    discountAmount: 0,
    finalLineTotal: 100 * quantity,
    availableQuantity: 5,
    backorderQuantity: 0,
    reservationExpiresAt: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
    ...overrides,
  };
}

function cart(items: CartItem[], overrides: Partial<Cart> = {}): Cart {
  const total = items.reduce((sum, i) => sum + i.finalLineTotal, 0);
  return {
    id: 'cart-1',
    cartToken: 'guest',
    items,
    baseTotal: total,
    totalDiscount: 0,
    totalPrice: total,
    removedExpiredItems: [],
    ...overrides,
  };
}

function problem(field: string, code: string) {
  return { errors: { [field]: [code] }, status: 0 };
}

describe('CartService', () => {
  let httpMock: HttpTestingController;
  let toastr: jasmine.SpyObj<ToastrService>;
  let service: CartService;
  let state: CartState;

  function create(): void {
    toastr = jasmine.createSpyObj<ToastrService>('ToastrService', ['info', 'warning']);
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        { provide: ToastrService, useValue: toastr },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
        { provide: HTTP_INTERCEPTORS, useClass: CartAuthInterceptor, multi: true },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    service = TestBed.inject(CartService);
    service.state$.subscribe((s) => (state = s));
  }

  // A guest with a stored token; the initial GET is answered with the given cart.
  function createWithCart(initial: Cart): void {
    localStorage.setItem(StorageKeys.CartToken, 'guest');
    create();
    httpMock.expectOne(cartUrl).flush(initial);
  }

  beforeEach(() => localStorage.clear());
  afterEach(() => {
    // Stops the expiry timer and window listeners.
    service.ngOnDestroy();
    httpMock.verify();
    localStorage.clear();
  });

  it('does not call the server for a new guest and shows an empty cart', () => {
    create();

    httpMock.expectNone(cartUrl);
    expect(state.loaded).toBeTrue();
    expect(state.cart.items).toEqual([]);
    expect(localStorage.getItem(StorageKeys.CartToken)).toBeNull();
  });

  it('stores the guest token from the first add', () => {
    create();

    service.add('v-1').subscribe();
    const req = httpMock.expectOne(`${cartUrl}/items`);
    expect(req.request.body).toEqual({ productVariantId: 'v-1', quantity: 1 });
    req.flush(cart([item('1')], { cartToken: 'new-token' }));

    expect(localStorage.getItem(StorageKeys.CartToken)).toBe('new-token');
    expect(state.cart.items?.length).toBe(1);
  });

  it('sends one PATCH with the last quantity after the debounce', fakeAsync(() => {
    createWithCart(cart([item('1', 1)]));

    service.setQuantity('1', 2);
    tick(100);
    service.setQuantity('1', 3);
    tick(100);
    service.setQuantity('1', 4);
    expect(state.pendingQuantities['1']).toBe(4);
    tick(399);
    httpMock.expectNone(`${cartUrl}/items/1`);

    tick(1);
    const req = httpMock.expectOne(`${cartUrl}/items/1`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ quantity: 4 });
    req.flush(cart([item('1', 4)]));

    expect(state.pendingQuantities['1']).toBeUndefined();
    expect(state.cart.totalPrice).toBe(400);
    service.ngOnDestroy();
  }));

  it('debounces each line on its own', fakeAsync(() => {
    createWithCart(cart([item('1'), item('2')]));

    service.setQuantity('1', 2);
    service.setQuantity('2', 3);
    tick(400);

    httpMock.expectOne(`${cartUrl}/items/1`).flush(cart([item('1', 2), item('2')]));
    httpMock.expectOne(`${cartUrl}/items/2`).flush(cart([item('1', 2), item('2', 3)]));
    expect(state.cart.totalPrice).toBe(500);
    service.ngOnDestroy();
  }));

  it('ignores a response that arrives after a newer one', fakeAsync(() => {
    createWithCart(cart([item('1'), item('2')]));

    service.setQuantity('1', 2);
    service.setQuantity('2', 3);
    tick(400);
    const first = httpMock.expectOne(`${cartUrl}/items/1`);
    const second = httpMock.expectOne(`${cartUrl}/items/2`);

    second.flush(cart([item('1', 2), item('2', 3)]));
    first.flush(cart([item('1', 2), item('2', 1)]));

    expect(state.cart.items?.find((i) => i.id === '2')?.quantity).toBe(3);
    service.ngOnDestroy();
  }));

  it('shows the 10-per-item error on the line, drops the optimistic value and refetches', fakeAsync(() => {
    createWithCart(cart([item('1', 10)]));

    service.setQuantity('1', 11);
    tick(400);
    httpMock
      .expectOne(`${cartUrl}/items/1`)
      .flush(problem('quantity', 'cartItemLimitExceeded'), { status: 409, statusText: 'Conflict' });

    expect(state.lineErrors['1']).toBe('apiErrors.cartItemLimitExceeded');
    expect(state.pendingQuantities['1']).toBeUndefined();
    httpMock.expectOne(cartUrl).flush(cart([item('1', 10)]));
    expect(state.lineErrors['1']).toBe('apiErrors.cartItemLimitExceeded');
    service.ngOnDestroy();
  }));

  it('refetches when a line was already removed in another tab', () => {
    createWithCart(cart([item('1')]));

    service.remove('1');
    httpMock
      .expectOne(`${cartUrl}/items/1`)
      .flush(problem('cartItemId', 'cartItemNotFound'), { status: 404, statusText: 'Not Found' });

    expect(toastr.info).toHaveBeenCalled();
    httpMock.expectOne(cartUrl).flush(cart([]));
    expect(state.cart.items).toEqual([]);
  });

  it('drops the guest token on cartNotFound', () => {
    createWithCart(cart([item('1')]));

    service.remove('1');
    httpMock
      .expectOne(`${cartUrl}/items/1`)
      .flush(problem('cart', 'cartNotFound'), { status: 404, statusText: 'Not Found' });

    expect(localStorage.getItem(StorageKeys.CartToken)).toBeNull();
    // No token left, so the refetch is answered locally with an empty cart.
    httpMock.expectNone(cartUrl);
    expect(state.cart.items).toEqual([]);
  });

  it('does not retry after 429', () => {
    createWithCart(cart([item('1')]));

    service.add('v-2').subscribe({ error: () => undefined });
    httpMock.expectOne(`${cartUrl}/items`).flush(null, { status: 429, statusText: 'Too Many Requests' });

    httpMock.expectNone(cartUrl);
  });

  it('keeps expired lines across refetches until dismissed', () => {
    const expired = item('old');
    createWithCart(cart([], { removedExpiredItems: [expired] }));

    expect(state.expiredItems).toEqual([expired]);
    service.load();
    httpMock.expectOne(cartUrl).flush(cart([]));
    expect(state.expiredItems).toEqual([expired]);

    // Hiding one is local: nothing goes to the server
    service.dismissExpired('old');
    httpMock.expectNone(() => true);
    expect(state.expiredItems).toEqual([]);
  });

  it('adds an expired line again with its old quantity', () => {
    const expired = item('old', 3);
    createWithCart(cart([], { removedExpiredItems: [expired] }));

    service.readd(expired);
    expect(state.readdingLineIds).toEqual(['old']);
    const req = httpMock.expectOne(`${cartUrl}/items`);
    expect(req.request.body).toEqual({ productVariantId: 'v-old', quantity: 3 });
    req.flush(cart([item('new', 3, { productVariantId: 'v-old' })]));

    expect(state.expiredItems).toEqual([]);
    expect(state.readdingLineIds).toEqual([]);
    expect(state.cart.items?.map((i) => i.id)).toEqual(['new']);
  });

  it('shows why adding an expired line again failed, on that line', () => {
    const expired = item('old');
    createWithCart(cart([], { removedExpiredItems: [expired] }));

    service.readd(expired);
    httpMock
      .expectOne(`${cartUrl}/items`)
      .flush(problem('productVariantId', 'variantNotPurchasable'), { status: 409, statusText: 'Conflict' });
    httpMock.expectOne(cartUrl).flush(cart([]));

    expect(state.expiredItems).toEqual([expired]);
    expect(state.lineErrors['old']).toBe('apiErrors.variantNotPurchasable');
  });

  it('drops an expired line once the same product is in the cart again', () => {
    const expired = item('old');
    createWithCart(cart([], { removedExpiredItems: [expired] }));

    // Added again from the product page, not through the expired line
    service.add('v-old').subscribe();
    httpMock.expectOne(`${cartUrl}/items`).flush(cart([item('new', 1, { productVariantId: 'v-old' })]));

    expect(state.expiredItems).toEqual([]);
  });

  it('ignores a late report of an expired line whose product was added again since', () => {
    const old = item('old');
    createWithCart(cart([old]));

    service.load();
    const lateGet = httpMock.expectOne(cartUrl);
    service.add('v-old').subscribe();
    httpMock.expectOne(`${cartUrl}/items`).flush(cart([item('new', 1, { productVariantId: 'v-old' })]));
    // The GET sent before the add answers last, reporting the old line as expired
    lateGet.flush(cart([], { removedExpiredItems: [old] }));

    expect(state.expiredItems).toEqual([]);
    expect(state.cart.items?.map((i) => i.id)).toEqual(['new']);
  });

  it('forgets expired lines when the customer changes, including late answers for the previous one', () => {
    localStorage.setItem(StorageKeys.CustomerToken, 'token-a');
    localStorage.setItem(StorageKeys.CustomerEmail, 'a@example.com');
    create();
    const first = httpMock.expectOne(cartUrl);

    localStorage.setItem(StorageKeys.CustomerToken, 'token-b');
    localStorage.setItem(StorageKeys.CustomerEmail, 'b@example.com');
    window.dispatchEvent(new StorageEvent('storage', { key: StorageKeys.CustomerEmail }));
    httpMock.expectOne(cartUrl).flush(cart([], { cartToken: null }));
    // Customer A's cart reports an expired line, but it arrives after the switch
    first.flush(cart([], { cartToken: null, removedExpiredItems: [item('a-line')] }));

    expect(state.expiredItems).toEqual([]);
  });

  it('refetches once the earliest reservation expires', fakeAsync(() => {
    const soon = item('1', 1, {
      reservationExpiresAt: new Date(Date.now() + 5000).toISOString(),
    });
    createWithCart(cart([soon]));

    tick(5000);
    httpMock.expectNone(cartUrl);
    tick(1500);
    httpMock.expectOne(cartUrl).flush(cart([], { removedExpiredItems: [soon] }));

    expect(state.cart.items).toEqual([]);
    expect(state.expiredItems.map((i) => i.id)).toEqual(['1']);
    service.ngOnDestroy();
  }));

  it('on 401 shows an empty cart and does not fall back to the guest cart', () => {
    localStorage.setItem(StorageKeys.CustomerToken, 'jwt-without-exp');
    localStorage.setItem(StorageKeys.CartToken, 'guest-kept-after-failed-merge');
    create();

    const req = httpMock.expectOne(cartUrl);
    expect(req.request.headers.get('Authorization')).toBe('Bearer jwt-without-exp');
    req.flush(null, { status: 401, statusText: 'Unauthorized' });

    const auth = TestBed.inject(CustomerAuthService);
    expect(auth.state.sessionExpired).toBeTrue();
    expect(localStorage.getItem(StorageKeys.CustomerToken)).toBeNull();
    httpMock.expectNone(cartUrl);
    expect(state.cart.items).toEqual([]);
    expect(state.loadFailed).toBeFalse();

    // Coming back to the page keeps it that way until the user logs in.
    service.load();
    httpMock.expectNone(cartUrl);
  });

  it('a guest add after an expired session continues as a guest', () => {
    localStorage.setItem(StorageKeys.CustomerToken, 'jwt-without-exp');
    create();
    httpMock.expectOne(cartUrl).flush(null, { status: 401, statusText: 'Unauthorized' });
    const auth = TestBed.inject(CustomerAuthService);

    service.add('v-1').subscribe();
    const add = httpMock.expectOne(`${cartUrl}/items`);
    expect(add.request.headers.has('Authorization')).toBeFalse();
    add.flush(cart([item('1')], { cartToken: 'guest-new' }));

    expect(auth.state.sessionExpired).toBeFalse();
    httpMock.expectOne(cartUrl).flush(cart([item('1')], { cartToken: 'guest-new' }));
    expect(state.cart.items?.length).toBe(1);
  });
  it('reuses a GET already on its way instead of sending a second one', () => {
    localStorage.setItem(StorageKeys.CartToken, 'guest');
    create();

    // App start sent a GET; the cart page asks again before it is answered.
    service.load();
    httpMock.expectOne(cartUrl).flush(cart([item('1')]));
    expect(state.cart.items?.length).toBe(1);

    // Once answered, a new load() goes to the server again.
    service.load();
    httpMock.expectOne(cartUrl).flush(cart([item('1')]));
  });

  it('reloads the cart when another tab logs in as a different customer', () => {
    localStorage.setItem(StorageKeys.CustomerToken, 'token-a');
    localStorage.setItem(StorageKeys.CustomerEmail, 'a@example.com');
    create();
    const first = httpMock.expectOne(cartUrl);

    // The other tab writes the new token, then the new email.
    localStorage.setItem(StorageKeys.CustomerToken, 'token-b');
    localStorage.setItem(StorageKeys.CustomerEmail, 'b@example.com');
    window.dispatchEvent(new StorageEvent('storage', { key: StorageKeys.CustomerEmail }));

    const second = httpMock.expectOne(cartUrl);
    expect(second.request.headers.get('Authorization')).toBe('Bearer token-b');
    second.flush(cart([], { cartToken: null }));
    // The answer for the previous customer arrives late and is ignored.
    first.flush(cart([item('a-line')], { cartToken: null }));

    expect(state.cart.items).toEqual([]);
  });

  it('keeps the loading flags owned by the GET that replaced a dropped one', () => {
    localStorage.setItem(StorageKeys.CustomerToken, 'token-a');
    localStorage.setItem(StorageKeys.CustomerEmail, 'a@example.com');
    create();
    const dropped = httpMock.expectOne(cartUrl);

    localStorage.setItem(StorageKeys.CustomerToken, 'token-b');
    localStorage.setItem(StorageKeys.CustomerEmail, 'b@example.com');
    window.dispatchEvent(new StorageEvent('storage', { key: StorageKeys.CustomerEmail }));
    const current = httpMock.expectOne(cartUrl);

    // The dropped GET answering first does not end the loading of the current one.
    dropped.flush(cart([item('a-line')], { cartToken: null }));
    expect(state.loading).toBeTrue();

    current.flush(cart([item('b-line')], { cartToken: null }));
    expect(state.loading).toBeFalse();
    expect(state.cart.items?.map((i) => i.id)).toEqual(['b-line']);
  });

  it('does not report a load failure for a dropped GET that fails late', () => {
    localStorage.setItem(StorageKeys.CustomerToken, 'token-a');
    localStorage.setItem(StorageKeys.CustomerEmail, 'a@example.com');
    create();
    const dropped = httpMock.expectOne(cartUrl);

    localStorage.setItem(StorageKeys.CustomerToken, 'token-b');
    localStorage.setItem(StorageKeys.CustomerEmail, 'b@example.com');
    window.dispatchEvent(new StorageEvent('storage', { key: StorageKeys.CustomerEmail }));

    httpMock.expectOne(cartUrl).flush(cart([item('b-line')], { cartToken: null }));
    dropped.flush(null, { status: 500, statusText: 'Server Error' });

    expect(state.loadFailed).toBeFalse();
    expect(state.cart.items?.map((i) => i.id)).toEqual(['b-line']);
  });
});
