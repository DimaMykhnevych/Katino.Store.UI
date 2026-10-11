import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { CartItem } from 'src/app/core/models/cart/cart-item';

@Component({
  selector: 'app-cart-line',
  templateUrl: './cart-line.component.html',
  styleUrls: ['./cart-line.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CartLineComponent {
  @Input() item!: CartItem;
  @Input() pendingQuantity: number | undefined;
  @Input() removing = false;
  @Input() errorKey: string | undefined;
  // The hold ran out and the server dropped the line: shown greyed out, can be added again.
  @Input() expired = false;
  @Input() readding = false;
  @Output() quantityChange = new EventEmitter<number>();
  // Deletes an active line; hides an expired one.
  @Output() remove = new EventEmitter<void>();
  @Output() readd = new EventEmitter<void>();

  // The quantity the user picked; prices stay the server's until the PATCH answers.
  public get displayQuantity(): number {
    return this.pendingQuantity ?? this.item.quantity;
  }

  public get isPending(): boolean {
    return this.pendingQuantity !== undefined;
  }

  // A variant removed from the catalog comes back with no name and zero prices.
  public get isUnavailable(): boolean {
    return this.item.productName === null;
  }

  public get hasDiscount(): boolean {
    return this.item.discountAmount > 0;
  }

  public decrease(): void {
    if (this.displayQuantity > 1) {
      this.quantityChange.emit(this.displayQuantity - 1);
    }
  }

  // No client-side cap: the server owns the 10-per-item limit and answers with cartItemLimitExceeded.
  public increase(): void {
    this.quantityChange.emit(this.displayQuantity + 1);
  }
}
