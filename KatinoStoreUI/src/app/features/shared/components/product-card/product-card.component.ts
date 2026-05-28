import { Component, Input } from '@angular/core';
import { ProductListItem } from 'src/app/core/models/product/product-list-item';

@Component({
  selector: 'app-product-card',
  templateUrl: './product-card.component.html',
  styleUrls: ['./product-card.component.scss'],
})
export class ProductCardComponent {
  @Input() product!: ProductListItem;

  public readonly placeholderUrl = 'https://placehold.co/400x533';

  public onImageError(event: Event): void {
    (event.target as HTMLImageElement).src = this.placeholderUrl;
  }
}
