import { HttpClient } from '@angular/common/http';
import { Injectable, OnDestroy } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { ToastrService } from 'ngx-toastr';
import {
  BehaviorSubject,
  EMPTY,
  fromEvent,
  merge,
  Observable,
  Subject,
  throwError,
  timer,
} from 'rxjs';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  filter,
  finalize,
  groupBy,
  map,
  mergeMap,
  switchMap,
  takeUntil,
  tap,
  throttleTime,
} from 'rxjs/operators';
import { AppSettings } from '../settings';
import { StorageKeys } from '../constants/storage-keys';
import {
  ApiError,
  apiErrorMessageKey,
  parseApiError,
} from '../http/errors/api-error';
import { Cart, createEmptyCart, EMPTY_GUID } from '../models/cart/cart';
import { CartItem } from '../models/cart/cart-item';
import { AddCartItemRequest } from '../models/cart/add-cart-item-request';
import { UpdateCartItemRequest } from '../models/cart/update-cart-item-request';
import { CustomerAuthService } from '../auth/services/customer-auth.service';
import { CartTokenService } from './cart-token.service';

export interface CartState {
  // Last cart returned by the server. Prices and totals are shown only from here.
  cart: Cart;
  loaded: boolean;
  loading: boolean;
  loadFailed: boolean;
  // Quantity the user picked while the debounced PATCH has not been answered yet.
  pendingQuantities: Record<string, number>;
  removingLineIds: string[];
  // Translation key of the last write error per cart line (active or expired).
  lineErrors: Record<string, string>;
  // Lines the server dropped when their hold ran out (removedExpiredItems). The server keeps no trace
  // of them, so they live only in memory here: shown greyed out until added again or dismissed, and
  // forgotten on reload or when the customer changes.
  expiredItems: CartItem[];
  // Expired lines being added again.
  readdingLineIds: string[];
}

interface QuantityChange {
  lineId: string;
  quantity: number;
}

const QUANTITY_DEBOUNCE_MS = 400;
const FOCUS_REFETCH_THROTTLE_MS = 5000;
// Wait a bit past reservationExpiresAt so the server sees the line as expired.
const EXPIRY_REFETCH_GRACE_MS = 1500;
// If the client clock runs ahead of the server, the refetch at expiry still returns the line.
// Then retry less eagerly instead of looping.
const EXPIRY_REFETCH_RETRY_MS = 30000;

@Injectable({
  providedIn: 'root',
})
export class CartService implements OnDestroy {
  private readonly _cartUrl = `${AppSettings.apiHost}/Cart`;
  private readonly _state$ = new BehaviorSubject<CartState>({
    cart: createEmptyCart(),
    loaded: false,
    loading: false,
    loadFailed: false,
    pendingQuantities: {},
    removingLineIds: [],
    lineErrors: {},
    expiredItems: [],
    readdingLineIds: [],
  });
  private readonly _quantityChanges$ = new Subject<QuantityChange>();
  private readonly _expiryRefetch$ = new Subject<number>();
  private readonly _destroy$ = new Subject<void>();

  // Responses can arrive out of order (debounced PATCHes on several lines, a GET on focus).
  // Only a response to a request sent later than the applied one may replace the cart.
  private _requestSeq = 0;
  private _appliedSeq = 0;
  // The GET on its way, if any. A second load() right after it (app start, then the cart page) reuses it.
  private _inflightGetSeq: number | null = null;
  // Requests up to this one were sent for a previous customer (or guest); none of their answer applies.
  private _identitySeq = 0;
  private _pendingExpiry: number | null = null;
  private _lastExpiryRefetchAt: number | null = null;

  constructor(
    private _http: HttpClient,
    private _cartToken: CartTokenService,
    private _auth: CustomerAuthService,
    private _toastr: ToastrService,
    private _translate: TranslateService,
  ) {
    this._listenToQuantityChanges();
    this._listenToExpiry();
    this._listenToAuth();
    this._listenToFocusAndOtherTabs();
  }

  public get state$(): Observable<CartState> {
    return this._state$.asObservable();
  }

  public get itemsCount$(): Observable<number> {
    return this._state$.pipe(
      map((s) => s.cart.items?.length ?? 0),
      distinctUntilChanged(),
    );
  }

  public ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  public load(): void {
    if (this._auth.state.sessionExpired) {
      this._resetToEmpty();
      return;
    }

    // Nothing to ask the server about: a guest without a token has an empty cart.
    if (!this._auth.state.isLoggedIn && !this._cartToken.token) {
      this._resetToEmpty();
      return;
    }

    // Nothing was sent after the GET in flight, so its answer is as fresh as a new one would be.
    if (this._inflightGetSeq === this._requestSeq) {
      return;
    }

    const seq = ++this._requestSeq;
    this._inflightGetSeq = seq;
    this._patchState({ loading: true });

    this._http
      .get<Cart>(this._cartUrl)
      .pipe(
        finalize(() => {
          if (this._inflightGetSeq === seq) {
            this._inflightGetSeq = null;
          }
        }),
        takeUntil(this._destroy$),
      )
      .subscribe({
        // A dropped GET (identity changed while it was on its way) must not touch the loading flags:
        // the GET that replaced it owns them. finalize runs after these, so the seq is still set here.
        next: (cart) => {
          this._applyCart(cart, seq);
          if (this._inflightGetSeq === seq) {
            this._patchState({ loading: false, loadFailed: false });
          }
        },
        error: (error: unknown) => {
          if (this._inflightGetSeq === seq) {
            this._patchState({
              loading: false,
              loadFailed: parseApiError(error).status !== 401,
            });
          }
        },
      });
  }

  // Errors are rethrown as ApiError so the product page can show them next to its button.
  public add(productVariantId: string, quantity = 1): Observable<Cart> {
    const seq = ++this._requestSeq;
    const body: AddCartItemRequest = { productVariantId, quantity };

    return this._http.post<Cart>(`${this._cartUrl}/items`, body).pipe(
      tap((cart) => {
        this._applyCart(cart, seq);
        // A guest add after an expired session is an explicit choice to continue as a guest.
        this._auth.continueAsGuest();
      }),
      catchError((error: unknown) => {
        const apiError = parseApiError(error);
        this._refetchAfterError(apiError);
        return throwError(apiError);
      }),
    );
  }

  public setQuantity(lineId: string, quantity: number): void {
    if (quantity < 1) {
      return;
    }

    const { [lineId]: _, ...lineErrors } = this._state.lineErrors;
    this._patchState({
      pendingQuantities: {
        ...this._state.pendingQuantities,
        [lineId]: quantity,
      },
      lineErrors,
    });
    this._quantityChanges$.next({ lineId, quantity });
  }

  public remove(lineId: string): void {
    if (this._state.removingLineIds.includes(lineId)) {
      return;
    }

    const seq = ++this._requestSeq;
    this._patchState({
      removingLineIds: [...this._state.removingLineIds, lineId],
    });

    this._http
      .delete<Cart>(`${this._cartUrl}/items/${lineId}`)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (cart) => {
          this._finishRemoving(lineId);
          this._applyCart(cart, seq);
        },
        error: (error: unknown) => {
          this._finishRemoving(lineId);
          this._handleWriteError(parseApiError(error), lineId);
        },
      });
  }

  // Adds an expired line again with its old quantity; the server starts a new hold for it.
  public readd(item: CartItem): void {
    if (this._state.readdingLineIds.includes(item.id)) {
      return;
    }

    const { [item.id]: _, ...lineErrors } = this._state.lineErrors;
    this._patchState({
      readdingLineIds: [...this._state.readdingLineIds, item.id],
      lineErrors,
    });

    this.add(item.productVariantId, item.quantity)
      .pipe(
        finalize(() =>
          this._patchState({
            readdingLineIds: this._state.readdingLineIds.filter(
              (id) => id !== item.id,
            ),
          }),
        ),
        takeUntil(this._destroy$),
      )
      .subscribe({
        // On success the line is back in the cart, which drops it from the expired list. If this answer
        // lost the race to a newer one that was sent before the add reached the server, the cart shown
        // still lacks the line: ask again rather than keep it greyed out until the next refetch.
        next: (cart) => {
          const variantId = item.productVariantId;
          const inCart = (cart.items ?? []).some(
            (i) => i.productVariantId === variantId,
          );
          const stillExpired = this._state.expiredItems.some(
            (i) => i.productVariantId === variantId,
          );
          if (inCart && stillExpired) {
            this.load();
          }
        },
        error: (error: ApiError) => {
          if (error.status === 401) {
            return;
          }
          this._patchState({
            lineErrors: {
              ...this._state.lineErrors,
              [item.id]: apiErrorMessageKey(error),
            },
          });
        },
      });
  }

  // Hides an expired line; nothing to tell the server, it no longer has the line.
  public dismissExpired(lineId: string): void {
    const { [lineId]: _, ...lineErrors } = this._state.lineErrors;
    this._patchState({
      expiredItems: this._state.expiredItems.filter((i) => i.id !== lineId),
      lineErrors,
    });
  }

  private get _state(): CartState {
    return this._state$.value;
  }

  private _patchState(patch: Partial<CartState>): void {
    this._state$.next({ ...this._state, ...patch });
  }

  // Responses to requests already sent belong to the previous identity (or state): never apply them.
  private _dropResponsesInFlight(): void {
    this._appliedSeq = this._requestSeq;
    this._inflightGetSeq = null;
  }

  private _resetToEmpty(): void {
    this._dropResponsesInFlight();
    this._patchState({
      cart: createEmptyCart(),
      loaded: true,
      loading: false,
      loadFailed: false,
      pendingQuantities: {},
      removingLineIds: [],
      lineErrors: {},
    });
    this._expiryRefetch$.next(-1);
  }

  private _applyCart(cart: Cart, seq: number): void {
    if (seq <= this._identitySeq) {
      return;
    }

    // Expired lines are reported only by the response that removed them, so keep them even if that
    // response is otherwise stale. What counts as "in the cart" is the newer of this response and the
    // cart already shown.
    const isStale = seq <= this._appliedSeq;
    this._rememberExpired(
      cart.removedExpiredItems ?? [],
      (isStale ? this._state.cart.items : cart.items) ?? [],
    );

    if (isStale) {
      return;
    }
    this._appliedSeq = seq;

    this._syncGuestToken(cart);

    const items = cart.items ?? [];
    const activeVariants = new Set(items.map((i) => i.productVariantId));
    // A product back in the cart (added again, here or anywhere else) is no longer shown as expired.
    const expiredItems = this._state.expiredItems.filter(
      (i) => !activeVariants.has(i.productVariantId),
    );
    const lineIds = new Set(items.map((i) => i.id));
    const shownIds = new Set([...lineIds, ...expiredItems.map((i) => i.id)]);
    this._patchState({
      cart: { ...cart, items },
      loaded: true,
      expiredItems,
      pendingQuantities: this._pick(this._state.pendingQuantities, lineIds),
      lineErrors: this._pick(this._state.lineErrors, shownIds),
    });

    this._scheduleExpiryRefetch(items);
  }

  // Newest first, one entry per variant; never one that is in the cart again.
  private _rememberExpired(removed: CartItem[], inCart: CartItem[]): void {
    if (!removed.length) {
      return;
    }

    const active = new Set(inCart.map((i) => i.productVariantId));
    const fresh = removed.filter((i) => !active.has(i.productVariantId));
    const freshVariants = new Set(fresh.map((i) => i.productVariantId));
    this._patchState({
      expiredItems: [
        ...fresh,
        ...this._state.expiredItems.filter(
          (i) => !freshVariants.has(i.productVariantId),
        ),
      ],
    });
  }

  private _syncGuestToken(cart: Cart): void {
    if (this._auth.state.isLoggedIn) {
      return;
    }

    if (cart.cartToken) {
      this._cartToken.token = cart.cartToken;
      return;
    }

    // The server did not recognise the stored token (cart cleaned up): drop it.
    if (cart.id === EMPTY_GUID) {
      this._cartToken.token = null;
    }
  }

  private _listenToQuantityChanges(): void {
    this._quantityChanges$
      .pipe(
        groupBy((change) => change.lineId),
        mergeMap((line$) =>
          line$.pipe(
            debounceTime(QUANTITY_DEBOUNCE_MS),
            switchMap((change) => this._sendQuantity(change)),
          ),
        ),
        takeUntil(this._destroy$),
      )
      .subscribe();
  }

  private _sendQuantity(change: QuantityChange): Observable<void> {
    const seq = ++this._requestSeq;
    const body: UpdateCartItemRequest = { quantity: change.quantity };

    return this._http
      .patch<Cart>(`${this._cartUrl}/items/${change.lineId}`, body)
      .pipe(
        map((cart) => {
          this._settlePending(change);
          this._applyCart(cart, seq);
        }),
        catchError((error: unknown) => {
          this._settlePending(change);
          this._handleWriteError(parseApiError(error), change.lineId);
          return EMPTY;
        }),
      );
  }

  // Keep the optimistic value only if the user changed the quantity again in the meantime.
  private _settlePending(change: QuantityChange): void {
    if (this._state.pendingQuantities[change.lineId] !== change.quantity) {
      return;
    }

    const { [change.lineId]: _, ...pendingQuantities } =
      this._state.pendingQuantities;
    this._patchState({ pendingQuantities });
  }

  private _finishRemoving(lineId: string): void {
    this._patchState({
      removingLineIds: this._state.removingLineIds.filter(
        (id) => id !== lineId,
      ),
    });
  }

  private _handleWriteError(error: ApiError, lineId: string): void {
    if (error.code === 'cartNotFound') {
      if (!this._auth.state.isLoggedIn) {
        this._cartToken.token = null;
      }
      this.load();
      return;
    }

    if (error.code === 'cartItemNotFound') {
      this._toastr.info(this._translate.instant('cart.lineAlreadyRemoved'));
      this.load();
      return;
    }

    if (error.status === 409 || error.status === 400) {
      this._patchState({
        lineErrors: {
          ...this._state.lineErrors,
          [lineId]: apiErrorMessageKey(error),
        },
      });
      this.load();
      return;
    }

    if (error.status !== 401) {
      this._toastr.warning(this._translate.instant(apiErrorMessageKey(error)));
    }
    this._refetchAfterError(error);
  }

  // Cart writes can fail because another tab changed the cart; the server state wins.
  // 401 resets the cart through the auth state; after 429 we do not add more requests.
  private _refetchAfterError(error: ApiError): void {
    if (error.status === 401 || error.status === 429) {
      return;
    }

    this.load();
  }

  private _scheduleExpiryRefetch(items: CartItem[]): void {
    if (!items.length) {
      this._expiryRefetch$.next(-1);
      return;
    }

    const earliest = Math.min(
      ...items.map((i) => new Date(i.reservationExpiresAt).getTime()),
    );
    let delay = earliest - Date.now() + EXPIRY_REFETCH_GRACE_MS;

    if (this._lastExpiryRefetchAt === earliest) {
      delay = Math.max(delay, EXPIRY_REFETCH_RETRY_MS);
    }

    this._expiryRefetch$.next(Math.max(delay, 0));
    this._pendingExpiry = earliest;
  }

  private _listenToExpiry(): void {
    this._expiryRefetch$
      .pipe(
        switchMap((delay) => (delay < 0 ? EMPTY : timer(delay))),
        takeUntil(this._destroy$),
      )
      .subscribe(() => {
        this._lastExpiryRefetchAt = this._pendingExpiry;
        this.load();
      });
  }

  private _listenToAuth(): void {
    this._auth.state$
      .pipe(
        // The email changes alone when another tab logs in as a different customer.
        distinctUntilChanged(
          (a, b) =>
            a.isLoggedIn === b.isLoggedIn &&
            a.sessionExpired === b.sessionExpired &&
            a.email === b.email,
        ),
        takeUntil(this._destroy$),
      )
      .subscribe(() => {
        // Another customer (or none): the previous one's answers and expired lines don't belong here.
        this._identitySeq = this._requestSeq;
        this._dropResponsesInFlight();
        this._patchState({ expiredItems: [], readdingLineIds: [] });
        this.load();
      });
  }

  // Coming back to the tab, or another tab creating/dropping the guest cart, refetches the cart.
  private _listenToFocusAndOtherTabs(): void {
    const focus$ = merge(
      fromEvent(window, 'focus'),
      fromEvent(document, 'visibilitychange').pipe(
        filter(() => document.visibilityState === 'visible'),
      ),
    ).pipe(throttleTime(FOCUS_REFETCH_THROTTLE_MS));

    const otherTab$ = fromEvent<StorageEvent>(window, 'storage').pipe(
      filter((e) => e.key === StorageKeys.CartToken),
    );

    merge(focus$, otherTab$)
      .pipe(takeUntil(this._destroy$))
      .subscribe(() => {
        this._auth.checkTokenExpiry();
        this.load();
      });
  }

  private _pick<T>(
    record: Record<string, T>,
    keys: Set<string>,
  ): Record<string, T> {
    return Object.keys(record)
      .filter((key) => keys.has(key))
      .reduce<Record<string, T>>((result, key) => {
        result[key] = record[key];
        return result;
      }, {});
  }
}
