import { Component, EventEmitter, Output } from '@angular/core';
import { CatalogFilters } from 'src/app/core/models/catalog/catalog-filters';
import { CategoryFilterChange } from 'src/app/core/models/catalog/category-filter-change';

@Component({
  selector: 'app-catalog-filters',
  templateUrl: './catalog-filters.component.html',
  styleUrls: ['./catalog-filters.component.scss'],
})
export class CatalogFiltersComponent {
  @Output() filtersChange = new EventEmitter<CatalogFilters>();

  private _categoryIds: string[] = [];
  private _collectionIds: string[] = [];
  private _returnSpecificDiscountProducts: boolean = false;

  public onCategoryFilterChange(change: CategoryFilterChange): void {
    this._categoryIds = change.categoryIds;
    this._returnSpecificDiscountProducts = change.returnSpecificDiscountProducts;
    this._emitChange();
  }

  public onCollectionFilterChange(collectionIds: string[]): void {
    this._collectionIds = collectionIds;
    this._emitChange();
  }

  private _emitChange(): void {
    this.filtersChange.emit({
      categoryIds: this._categoryIds,
      collectionIds: this._collectionIds,
      returnSpecificDiscountProducts: this._returnSpecificDiscountProducts,
    });
  }
}
