import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AppSettings } from '../../settings';
import { StorageKeys } from '../../constants/storage-keys';
import { LoginErrorCode } from '../../enums/login-error-code';
import { LoginOutcome } from '../models/login-outcome';
import { CustomerAuthResult } from '../models/customer-auth-result';
import { CustomerAuthService } from './customer-auth.service';

// Unsigned JWT with the given exp (seconds since epoch); only the payload is read on the client.
function jwt(exp: number): string {
  const payload = btoa(JSON.stringify({ exp }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `header.${payload}.signature`;
}

function success(cartMerged: boolean | null): CustomerAuthResult {
  return {
    token: jwt(Date.now() / 1000 + 3600),
    isAuthorized: true,
    customerInfo: { customerId: 'c1', email: 'a@b.c', registryDate: '' },
    loginErrorCode: LoginErrorCode.none,
    cartMerged,
  };
}

describe('CustomerAuthService', () => {
  const loginUrl = `${AppSettings.apiHost}/CustomerAuth/token`;
  let httpMock: HttpTestingController;

  function create(): CustomerAuthService {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    httpMock = TestBed.inject(HttpTestingController);
    return TestBed.inject(CustomerAuthService);
  }

  function login(
    service: CustomerAuthService,
    result: CustomerAuthResult,
  ): LoginOutcome | null {
    let outcome: LoginOutcome | null = null;
    service
      .login({ email: 'a@b.c', password: 'secret' })
      .subscribe((o) => (outcome = o));
    httpMock.expectOne(loginUrl).flush(result);
    return outcome;
  }

  beforeEach(() => localStorage.clear());
  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('sends the guest token with login and drops it when the cart was merged', () => {
    localStorage.setItem(StorageKeys.CartToken, 'guest');
    const service = create();

    service.login({ email: 'a@b.c', password: 'secret' }).subscribe();
    const req = httpMock.expectOne(loginUrl);
    expect(req.request.headers.get('X-Cart-Token')).toBe('guest');
    req.flush(success(true));

    expect(localStorage.getItem(StorageKeys.CartToken)).toBeNull();
    expect(localStorage.getItem(StorageKeys.CustomerToken)).toBeTruthy();
    expect(service.state.isLoggedIn).toBeTrue();
    expect(service.state.cartMergeFailed).toBeFalse();
  });

  it('keeps the guest token and reports the failure when the merge failed', () => {
    localStorage.setItem(StorageKeys.CartToken, 'guest');
    const service = create();

    const outcome = login(service, success(false));

    expect(outcome?.cartMergeFailed).toBeTrue();
    expect(localStorage.getItem(StorageKeys.CartToken)).toBe('guest');
    expect(service.state.isLoggedIn).toBeTrue();
    expect(service.state.cartMergeFailed).toBeTrue();
  });

  it('sends no guest header and changes nothing about it when there was no guest cart', () => {
    const service = create();

    service.login({ email: 'a@b.c', password: 'secret' }).subscribe();
    const req = httpMock.expectOne(loginUrl);
    expect(req.request.headers.has('X-Cart-Token')).toBeFalse();
    req.flush(success(null));

    expect(service.state.isLoggedIn).toBeTrue();
    expect(service.state.cartMergeFailed).toBeFalse();
  });

  it('stores nothing on wrong credentials or unconfirmed email', () => {
    const service = create();
    for (const code of [
      LoginErrorCode.invalidUsernameOrPassword,
      LoginErrorCode.emailConfirmationRequired,
    ]) {
      const outcome = login(service, {
        token: null,
        isAuthorized: false,
        customerInfo: null,
        loginErrorCode: code,
        cartMerged: null,
      });

      expect(outcome?.loginErrorCode).toBe(code);
      expect(localStorage.getItem(StorageKeys.CustomerToken)).toBeNull();
      expect(service.state.isLoggedIn).toBeFalse();
    }
  });

  it('treats an expired stored token as an expired session on start', () => {
    localStorage.setItem(StorageKeys.CustomerToken, jwt(Date.now() / 1000 - 60));
    const service = create();

    expect(service.state.isLoggedIn).toBeFalse();
    expect(service.state.sessionExpired).toBeTrue();
    expect(localStorage.getItem(StorageKeys.CustomerToken)).toBeNull();
  });

  it('logout clears the customer token without marking the session expired', () => {
    localStorage.setItem(StorageKeys.CustomerToken, jwt(Date.now() / 1000 + 3600));
    const service = create();

    service.logout();

    expect(localStorage.getItem(StorageKeys.CustomerToken)).toBeNull();
    expect(service.state).toEqual({
      isLoggedIn: false,
      email: null,
      sessionExpired: false,
      cartMergeFailed: false,
    });
  });
});
