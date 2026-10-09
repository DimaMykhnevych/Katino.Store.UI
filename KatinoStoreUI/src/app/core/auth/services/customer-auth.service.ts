import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, fromEvent, Observable, Subject } from 'rxjs';
import { filter, map, takeUntil } from 'rxjs/operators';
import { AppSettings } from '../../settings';
import { StorageKeys } from '../../constants/storage-keys';
import { LoginErrorCode } from '../../enums/login-error-code';
import { readStorage, removeStorage, writeStorage } from '../../http/storage.util';
import { CartTokenService } from '../../cart/cart-token.service';
import { CustomerTokenService } from './customer-token.service';
import { CustomerAuthResult } from '../models/customer-auth-result';
import { SignInRequest } from '../models/sign-in-request';
import { RegisterRequest } from '../models/register-request';
import { ConfirmEmailRequest } from '../models/confirm-email-request';
import { LoginOutcome } from '../models/login-outcome';

export interface AuthState {
  isLoggedIn: boolean;
  email: string | null;
  // The customer token was rejected (401) or expired. The user stays logged out with an empty cart view
  // until they log in again or act as a guest; the guest cart is never shown in its place silently.
  sessionExpired: boolean;
  // Login succeeded but the guest cart could not be merged (cartMerged: false). The guest token is kept.
  cartMergeFailed: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class CustomerAuthService implements OnDestroy {
  private readonly _state$: BehaviorSubject<AuthState>;
  private readonly _destroy$ = new Subject<void>();

  constructor(
    private _http: HttpClient,
    private _customerToken: CustomerTokenService,
    private _cartToken: CartTokenService,
  ) {
    this._state$ = new BehaviorSubject<AuthState>({
      isLoggedIn: !!this._customerToken.token,
      email: readStorage(StorageKeys.CustomerEmail),
      sessionExpired: false,
      cartMergeFailed: false,
    });

    this.checkTokenExpiry();
    this._listenToOtherTabs();
  }

  public get state$(): Observable<AuthState> {
    return this._state$.asObservable();
  }

  public get state(): AuthState {
    return this._state$.value;
  }

  public ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  public login(request: SignInRequest): Observable<LoginOutcome> {
    const guestToken = this._cartToken.token;
    const headers = guestToken
      ? new HttpHeaders({ 'X-Cart-Token': guestToken })
      : undefined;

    return this._http
      .post<CustomerAuthResult>(
        `${AppSettings.apiHost}/CustomerAuth/token`,
        request,
        { headers },
      )
      .pipe(map((result) => this._handleLoginResult(result)));
  }

  public register(request: RegisterRequest): Observable<boolean> {
    return this._http.post<boolean>(
      `${AppSettings.apiHost}/CustomerAuth/register`,
      request,
    );
  }

  public confirmEmail(request: ConfirmEmailRequest): Observable<boolean> {
    return this._http.post<boolean>(
      `${AppSettings.apiHost}/CustomerAuth/confirm-email`,
      request,
    );
  }

  // No logout endpoint: the JWT is stateless, so only the client copy is dropped.
  public logout(): void {
    this._clearCustomer();
    this._setState({
      isLoggedIn: false,
      email: null,
      sessionExpired: false,
      cartMergeFailed: false,
    });
  }

  // Called on 401 from a cart call that carried the customer token.
  public expireSession(): void {
    if (!this._customerToken.token && this.state.sessionExpired) {
      return;
    }

    this._clearCustomer();
    this._setState({
      isLoggedIn: false,
      email: null,
      sessionExpired: true,
      cartMergeFailed: false,
    });
  }

  public checkTokenExpiry(): void {
    const token = this._customerToken.token;
    if (token && this._customerToken.isExpired(token)) {
      this.expireSession();
    }
  }

  // The user chose to continue as a guest (for example, added a product after the session expired).
  public continueAsGuest(): void {
    if (this.state.sessionExpired) {
      this._setState({ ...this.state, sessionExpired: false });
    }
  }

  public dismissCartMergeFailed(): void {
    if (this.state.cartMergeFailed) {
      this._setState({ ...this.state, cartMergeFailed: false });
    }
  }

  private _handleLoginResult(result: CustomerAuthResult): LoginOutcome {
    if (
      result.loginErrorCode !== LoginErrorCode.none ||
      !result.isAuthorized ||
      !result.token
    ) {
      return { loginErrorCode: result.loginErrorCode, cartMergeFailed: false };
    }

    this._customerToken.token = result.token;
    const email = result.customerInfo?.email ?? null;
    if (email) {
      writeStorage(StorageKeys.CustomerEmail, email);
    }

    // true: the guest cart now belongs to the customer. false: merge failed, keep the guest token so the
    // items are not lost. null: no guest token was sent.
    if (result.cartMerged === true) {
      this._cartToken.token = null;
    }

    const cartMergeFailed = result.cartMerged === false;
    this._setState({
      isLoggedIn: true,
      email,
      sessionExpired: false,
      cartMergeFailed,
    });

    return { loginErrorCode: LoginErrorCode.none, cartMergeFailed };
  }

  private _clearCustomer(): void {
    this._customerToken.token = null;
    removeStorage(StorageKeys.CustomerEmail);
  }

  private _setState(state: AuthState): void {
    this._state$.next(state);
  }

  // Login or logout in another tab changes localStorage; mirror it here.
  private _listenToOtherTabs(): void {
    fromEvent<StorageEvent>(window, 'storage')
      .pipe(
        filter((e) => e.key === StorageKeys.CustomerToken || e.key === null),
        takeUntil(this._destroy$),
      )
      .subscribe(() => {
        const isLoggedIn = !!this._customerToken.token;
        if (isLoggedIn === this.state.isLoggedIn) {
          return;
        }

        this._setState({
          isLoggedIn,
          email: isLoggedIn ? readStorage(StorageKeys.CustomerEmail) : null,
          sessionExpired: false,
          cartMergeFailed: false,
        });
      });
  }
}
