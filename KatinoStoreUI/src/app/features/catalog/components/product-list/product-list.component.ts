import { Component, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { GetProductsRequest } from 'src/app/core/models/product/get-products-request';
import { ProductListItem } from 'src/app/core/models/product/product-list-item';
import { ProductService } from 'src/app/core/services/product.service';

@Component({
  selector: 'app-catalog-product-list',
  templateUrl: './product-list.component.html',
  styleUrls: ['./product-list.component.scss'],
})
export class CatalogProductListComponent implements OnInit, OnChanges {
  @Input() search: string = '';

  public products: ProductListItem[] = [];
  public totalCount: number = 0;
  public pageSize: number = 20;
  public pageIndex: number = 0;
  public isLoading: boolean = false;
  public isReloading: boolean = false;

  private _isFirstLoad = true;

  constructor(private _productService: ProductService) {}

  public ngOnInit(): void {
    this.loadProducts();
  }

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['search'] && !changes['search'].firstChange) {
      this.pageIndex = 0;
      this.loadProducts();
    }
  }

  public get totalPages(): number {
    return Math.ceil(this.totalCount / this.pageSize);
  }

  public onPageChange(pageIndex: number): void {
    this.pageIndex = pageIndex;
    this.loadProducts();
  }

  private loadProducts(): void {
    if (this._isFirstLoad) {
      this.isLoading = true;
    } else {
      this.isReloading = true;
    }

    const request: GetProductsRequest = {
      search: this.search || undefined,
      page: this.pageIndex + 1,
      pageSize: this.pageSize,
    };

    this._productService.getProductCards(request).subscribe({
      next: (response) => {
        this.products = response.items;
        this.totalCount = response.totalCount;
        this.isLoading = false;
        this.isReloading = false;
        this._isFirstLoad = false;

        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
      error: () => {
        this.isLoading = false;
        this.isReloading = false;
        this._isFirstLoad = false;
      },
    });
  }
}
