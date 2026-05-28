import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { ProductListItem } from 'src/app/core/models/product/product-list-item';
import { ProductService } from 'src/app/core/services/product.service';

@Component({
  selector: 'app-product-list',
  templateUrl: './product-list.component.html',
  styleUrls: ['./product-list.component.scss'],
})
export class ProductListComponent implements OnInit {
  @Output() loaded = new EventEmitter<void>();

  public products: ProductListItem[] = [];
  public isLoading: boolean = false;

  constructor(private _productService: ProductService) {}

  public ngOnInit(): void {
    this.isLoading = true;
    this._productService.getNewestProducts().subscribe({
      next: (products) => {
        this.products = products;
        this.isLoading = false;
        this.loaded.emit();
      },
      error: () => {
        this.isLoading = false;
        this.loaded.emit();
      },
    });
  }
}
