import { HTTP_INTERCEPTORS, HttpClient } from '@angular/common/http';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AppSettings } from '../../settings';
import { StorageKeys } from '../../constants/storage-keys';
import { CartAuthInterceptor } from './cart-auth.interceptor';
import { CustomerAuthService } from './customer-auth.service';

describe('CartAuthInterceptor', () => {
  const cartUrl = `${AppSettings.apiHost}/Cart`;
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let auth: jasmine.SpyObj<CustomerAuthService>;

  beforeEach(() => {
    localStorage.clear();
    auth = jasmine.createSpyObj<CustomerAuthService>('CustomerAuthService', [
      'expireSession',
    ]);

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        { provide: CustomerAuthService, useValue: auth },
        { provide: HTTP_INTERCEPTORS, useClass: CartAuthInterceptor, multi: true },
      ],
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('sends only the guest token when there is no customer token', () => {
    localStorage.setItem(StorageKeys.CartToken, 'guest');

    http.get(cartUrl).subscribe();
    const req = httpMock.expectOne(cartUrl);

    expect(req.request.headers.get('X-Cart-Token')).toBe('guest');
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush({});
  });

  it('sends only the bearer when the customer is logged in, even if a guest token is stored', () => {
    localStorage.setItem(StorageKeys.CartToken, 'guest');
    localStorage.setItem(StorageKeys.CustomerToken, 'jwt');

    http.get(`${cartUrl}/items/1`).subscribe();
    const req = httpMock.expectOne(`${cartUrl}/items/1`);

    expect(req.request.headers.get('Authorization')).toBe('Bearer jwt');
    expect(req.request.headers.has('X-Cart-Token')).toBeFalse();
    req.flush({});
  });

  it('does not touch requests outside the cart API', () => {
    localStorage.setItem(StorageKeys.CustomerToken, 'jwt');
    localStorage.setItem(StorageKeys.CartToken, 'guest');

    http.get(`${AppSettings.apiHost}/Product`).subscribe();
    http.get(`${AppSettings.apiHost}/CartsAreNotHere`).subscribe();

    for (const url of [`${AppSettings.apiHost}/Product`, `${AppSettings.apiHost}/CartsAreNotHere`]) {
      const req = httpMock.expectOne(url);
      expect(req.request.headers.keys()).toEqual([]);
      req.flush({});
    }
  });

  it('expires the session on 401 for a bearer call and still reports the error', () => {
    localStorage.setItem(StorageKeys.CustomerToken, 'jwt');
    let status = 0;

    http.get(cartUrl).subscribe({ error: (e) => (status = e.status) });
    httpMock.expectOne(cartUrl).flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(auth.expireSession).toHaveBeenCalled();
    expect(status).toBe(401);
  });

  it('passes other errors through unchanged', () => {
    localStorage.setItem(StorageKeys.CartToken, 'guest');
    let status = 0;

    http.get(cartUrl).subscribe({ error: (e) => (status = e.status) });
    httpMock.expectOne(cartUrl).flush(null, { status: 409, statusText: 'Conflict' });

    expect(auth.expireSession).not.toHaveBeenCalled();
    expect(status).toBe(409);
  });
});
