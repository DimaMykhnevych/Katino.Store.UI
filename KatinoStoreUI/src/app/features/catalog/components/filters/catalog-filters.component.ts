import { Component, EventEmitter, Output } from '@angular/core';
import { CatalogFilters } from 'src/app/core/models/catalog/catalog-filters';

@Component({
  selector: 'app-catalog-filters',
  templateUrl: './catalog-filters.component.html',
  styleUrls: ['./catalog-filters.component.scss'],
})
export class CatalogFiltersComponent {
  @Output() filtersChange = new EventEmitter<CatalogFilters>();

  private _filters: CatalogFilters = { categoryIds: [] };

  public onCategoryFilterChange(categoryIds: string[]): void {
    this._filters = { ...this._filters, categoryIds };
    this.filtersChange.emit({ ...this._filters });
  }
}
