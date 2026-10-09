import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
} from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AppSettings } from '../../settings';
import { CartTokenService } from '../../cart/cart-token.service';
import { CustomerTokenService } from './customer-token.service';
import { CustomerAuthService } from './customer-auth.service';

// Identifies the caller on cart calls: the customer bearer if logged in, otherwise the guest token.
// Exactly one of the two is sent, and only to our own API's cart endpoints.
@Injectable()
export class CartAuthInterceptor implements HttpInterceptor {
  private readonly _cartUrl = `${AppSettings.apiHost}/Cart`;

  constructor(
    private _customerToken: CustomerTokenService,
    private _cartToken: CartTokenService,
    private _auth: CustomerAuthService,
  ) {}

  public intercept(
    req: HttpRequest<unknown>,
    next: HttpHandler,
  ): Observable<HttpEvent<unknown>> {
    if (!this._isCartRequest(req.url)) {
      return next.handle(req);
    }

    const customerToken = this._customerToken.token;
    const guestToken = this._cartToken.token;
    let headers = req.headers;

    if (customerToken) {
      headers = headers.set('Authorization', `Bearer ${customerToken}`);
    } else if (guestToken) {
      headers = headers.set('X-Cart-Token', guestToken);
    }

    return next.handle(req.clone({ headers })).pipe(
      catchError((error: unknown) => {
        // 401 on a bearer call: the token expired or was rejected. Do not retry as a guest.
        if (
          customerToken &&
          error instanceof HttpErrorResponse &&
          error.status === 401
        ) {
          this._auth.expireSession();
        }

        return throwError(error);
      }),
    );
  }

  private _isCartRequest(url: string): boolean {
    return url === this._cartUrl || url.startsWith(`${this._cartUrl}/`);
  }
}
