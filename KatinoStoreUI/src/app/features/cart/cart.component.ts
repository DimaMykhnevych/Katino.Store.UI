import { Component, OnDestroy, OnInit } from '@angular/core';
import { combineLatest, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { RouteConstants } from 'src/app/core/constants/route-constants';
import { CartItem } from 'src/app/core/models/cart/cart-item';
import { CartService, CartState } from 'src/app/core/cart/cart.service';
import {
  AuthState,
  CustomerAuthService,
} from 'src/app/core/auth/services/customer-auth.service';

interface CartViewModel {
  cart: CartState;
  auth: AuthState;
  items: CartItem[];
  isUpdating: boolean;
}

@Component({
  selector: 'app-cart',
  templateUrl: './cart.component.html',
  styleUrls: ['./cart.component.scss'],
})
export class CartComponent implements OnInit, OnDestroy {
  public readonly vm$: Observable<CartViewModel>;
  public readonly loginRoute = RouteConstants.login;
  public readonly loginQueryParams = { returnUrl: RouteConstants.cart };

  constructor(
    private _cartService: CartService,
    private _auth: CustomerAuthService,
  ) {
    this.vm$ = combineLatest([this._cartService.state$, this._auth.state$]).pipe(
      map(([cart, auth]) => ({
        cart,
        auth,
        items: cart.cart.items ?? [],
        isUpdating: Object.keys(cart.pendingQuantities).length > 0,
      })),
    );
  }

  public ngOnInit(): void {
    this._auth.checkTokenExpiry();
    this._cartService.load();
  }

  // The expiry notice is one-time: leaving the page drops it.
  public ngOnDestroy(): void {
    this._cartService.dismissExpiredNotice();
  }

  public onQuantityChange(lineId: string, quantity: number): void {
    this._cartService.setQuantity(lineId, quantity);
  }

  public onRemove(lineId: string): void {
    this._cartService.remove(lineId);
  }

  public retry(): void {
    this._cartService.load();
  }

  public dismissExpiredNotice(): void {
    this._cartService.dismissExpiredNotice();
  }

  public dismissMergeFailed(): void {
    this._auth.dismissCartMergeFailed();
  }

  public trackById(_: number, item: CartItem): string {
    return item.id;
  }
}
