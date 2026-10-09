import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouteConstants } from 'src/app/core/constants/route-constants';
import { Cart } from 'src/app/core/models/cart/cart';

@Component({
  selector: 'app-cart-summary',
  templateUrl: './cart-summary.component.html',
  styleUrls: ['./cart-summary.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CartSummaryComponent {
  @Input() cart!: Cart;
  @Input() isLoggedIn = false;
  // A quantity change is still waiting for the server, so the totals are about to change.
  @Input() isUpdating = false;

  public readonly loginRoute = RouteConstants.login;
  public readonly loginQueryParams = { returnUrl: RouteConstants.cart };
}
