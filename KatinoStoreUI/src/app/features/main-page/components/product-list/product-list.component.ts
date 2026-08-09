import {
  Component,
  EventEmitter,
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ProductListItem } from 'src/app/core/models/product/product-list-item';
import { ProductService } from 'src/app/core/services/product.service';

@Component({
  selector: 'app-product-list',
  templateUrl: './product-list.component.html',
  styleUrls: ['./product-list.component.scss'],
})
export class ProductListComponent implements OnInit, OnDestroy {
  @Output() loaded = new EventEmitter<void>();

  public products: ProductListItem[] = [];
  public isLoading: boolean = false;

  private readonly _destroy$ = new Subject<void>();

  constructor(private _productService: ProductService) {}

  public ngOnInit(): void {
    this.isLoading = true;
    this._productService
      .getNewestProducts()
      .pipe(takeUntil(this._destroy$))
      .subscribe({
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

  public ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }
}
