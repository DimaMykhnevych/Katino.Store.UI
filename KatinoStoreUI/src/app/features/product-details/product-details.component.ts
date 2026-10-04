import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ProductVariantStatus } from 'src/app/core/enums/product-variant-status';
import { ProductCardColor } from 'src/app/core/models/color/product-card-color';
import { ProductCardMeasurement } from 'src/app/core/models/measurement-type/product-card-measurement';
import { ProductCardPhoto } from 'src/app/core/models/product-photo/product-card-photo';
import { ProductCard } from 'src/app/core/models/product/product-card';
import { ProductCardVariant } from 'src/app/core/models/product-variant/product-card-variant';
import { ProductCardSize } from 'src/app/core/models/size/product-card-size';
import { ProductService } from 'src/app/core/services/product.service';

@Component({
  selector: 'app-product-details',
  templateUrl: './product-details.component.html',
  styleUrls: ['./product-details.component.scss'],
})
export class ProductDetailsComponent implements OnInit, OnDestroy {
  public product: ProductCard | null = null;
  public isLoading = true;
  public notFound = false;

  public availableColors: ProductCardColor[] = [];
  public availableSizes: ProductCardSize[] = [];

  public selectedColorId: string | null = null;
  public selectedSizeId: string | null = null;

  private readonly _destroy$ = new Subject<void>();

  constructor(
    private _route: ActivatedRoute,
    private _productService: ProductService,
  ) {}

  public ngOnInit(): void {
    this._route.paramMap.pipe(takeUntil(this._destroy$)).subscribe((params) => {
      const id = params.get('id');

      if (id) {
        this._loadProduct(id);
      }
    });
  }

  public ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  public get selectedVariant(): ProductCardVariant | null {
    if (!this.product) {
      return null;
    }

    return (
      this.product.variants.find(
        (v) =>
          v.color.id === this.selectedColorId &&
          v.size.id === this.selectedSizeId,
      ) ?? null
    );
  }

  public get galleryPhotos(): ProductCardPhoto[] {
    const variantForColor = this.product?.variants.find(
      (v) => v.color.id === this.selectedColorId,
    );

    return variantForColor?.photos ?? [];
  }

  public get measurements(): ProductCardMeasurement[] {
    return this.selectedVariant?.measurements ?? [];
  }

  public get article(): string | null {
    return this.selectedVariant?.article ?? null;
  }

  public get availableQuantity(): number | null {
    return this.selectedVariant?.availableQuantity ?? null;
  }

  public get availableSizeIdsForSelectedColor(): string[] {
    if (!this.product) {
      return [];
    }

    return this.product.variants
      .filter((v) => v.color.id === this.selectedColorId)
      .map((v) => v.size.id);
  }

  public get shippingText(): string | null {
    const status = this.selectedVariant?.status;

    if (status === ProductVariantStatus.inStock) {
      return 'productDetails.shippingInStock';
    }

    if (status === ProductVariantStatus.onOrder) {
      return 'productDetails.shippingOnOrder';
    }

    return null;
  }

  public onColorSelected(colorId: string): void {
    this.selectedColorId = colorId;

    const hasCurrentSize = this.product?.variants.some(
      (v) => v.color.id === colorId && v.size.id === this.selectedSizeId,
    );

    if (!hasCurrentSize) {
      this.selectedSizeId =
        this.product?.variants.find((v) => v.color.id === colorId)?.size
          .id ?? null;
    }
  }

  public onSizeSelected(sizeId: string): void {
    this.selectedSizeId = sizeId;
  }

  private _loadProduct(id: string): void {
    this.isLoading = true;
    this.notFound = false;

    this._productService
      .getProductCard(id)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (product) => {
          this.product = product;
          this.availableColors = this._getDistinct(
            product.variants.map((v) => v.color),
          );
          this.availableSizes = this._getDistinct(
            product.variants.map((v) => v.size),
          );

          const firstVariant = product.variants[0] ?? null;
          this.selectedColorId = firstVariant?.color.id ?? null;
          this.selectedSizeId = firstVariant?.size.id ?? null;

          this.isLoading = false;
        },
        error: () => {
          this.isLoading = false;
          this.notFound = true;
        },
      });
  }

  private _getDistinct<T extends { id: string }>(items: T[]): T[] {
    const map = new Map<string, T>();
    items.forEach((item) => map.set(item.id, item));
    return Array.from(map.values());
  }
}
