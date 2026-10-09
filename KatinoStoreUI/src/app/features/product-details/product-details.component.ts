import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { ToastrService } from 'ngx-toastr';
import { Subject } from 'rxjs';
import { finalize, take, takeUntil } from 'rxjs/operators';
import { ProductVariantStatus } from 'src/app/core/enums/product-variant-status';
import { ProductCardColor } from 'src/app/core/models/color/product-card-color';
import { ProductCardMeasurement } from 'src/app/core/models/measurement-type/product-card-measurement';
import { ProductCardPhoto } from 'src/app/core/models/product-photo/product-card-photo';
import { ProductCard } from 'src/app/core/models/product/product-card';
import { ProductCardVariant } from 'src/app/core/models/product-variant/product-card-variant';
import { ProductCardSize } from 'src/app/core/models/size/product-card-size';
import { ProductService } from 'src/app/core/services/product.service';
import { CartService } from 'src/app/core/cart/cart.service';
import { Cart } from 'src/app/core/models/cart/cart';
import { RouteConstants } from 'src/app/core/constants/route-constants';
import {
  ApiError,
  apiErrorMessageKey,
} from 'src/app/core/http/errors/api-error';

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

  public isAddingToCart = false;
  public addToCartErrorKey: string | null = null;
  public readonly loginRoute = RouteConstants.login;

  // Variants the server refused with variantNotPurchasable since the page was opened.
  private readonly _notPurchasableVariantIds = new Set<string>();
  private readonly _destroy$ = new Subject<void>();

  constructor(
    private _route: ActivatedRoute,
    private _router: Router,
    private _productService: ProductService,
    private _cartService: CartService,
    private _toastr: ToastrService,
    private _translate: TranslateService,
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

  public get isSelectedVariantPurchasable(): boolean {
    const variant = this.selectedVariant;
    if (!variant) {
      return true;
    }

    return (
      variant.status !== ProductVariantStatus.discontinued &&
      !this._notPurchasableVariantIds.has(variant.id)
    );
  }

  public get loginQueryParams(): { returnUrl: string } {
    return { returnUrl: this._router.url };
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

  public onAddToCart(): void {
    const variant = this.selectedVariant;
    if (!variant || this.isAddingToCart) {
      return;
    }

    this.isAddingToCart = true;
    this.addToCartErrorKey = null;

    this._cartService
      .add(variant.id)
      .pipe(
        finalize(() => (this.isAddingToCart = false)),
        takeUntil(this._destroy$),
      )
      .subscribe({
        next: (cart) => this._onAddedToCart(cart),
        error: (error: ApiError) => this._onAddToCartFailed(variant.id, error),
      });
  }

  public onColorSelected(colorId: string): void {
    this.selectedColorId = colorId;
    this.addToCartErrorKey = null;

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
    this.addToCartErrorKey = null;
  }

  private _onAddedToCart(cart: Cart): void {
    this._toastr
      .success(this._translate.instant('productDetails.addedToCart'))
      .onTap.pipe(take(1))
      .subscribe(() => this._router.navigateByUrl(RouteConstants.cart));

    // This add also pruned expired lines; the cart page is not open to show the notice.
    const expiredCount = cart.removedExpiredItems?.length ?? 0;
    if (expiredCount > 0) {
      this._toastr.info(
        this._translate.instant('cart.expiredNotice', { count: expiredCount }),
      );
    }
  }

  private _onAddToCartFailed(variantId: string, error: ApiError): void {
    if (error.status === 401) {
      this.addToCartErrorKey = 'productDetails.sessionExpired';
      return;
    }

    if (error.code === 'variantNotPurchasable') {
      this._notPurchasableVariantIds.add(variantId);
    }

    this.addToCartErrorKey = apiErrorMessageKey(error);
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
