import { Component, EventEmitter, Output } from '@angular/core';
import { CatalogFilters } from 'src/app/core/models/catalog/catalog-filters';

@Component({
  selector: 'app-catalog-filters',
  templateUrl: './catalog-filters.component.html',
  styleUrls: ['./catalog-filters.component.scss'],
})
export class CatalogFiltersComponent {
  @Output() filtersChange = new EventEmitter<CatalogFilters>();

  public onCategoryFilterChange(filters: CatalogFilters): void {
    this.filtersChange.emit(filters);
  }
}
