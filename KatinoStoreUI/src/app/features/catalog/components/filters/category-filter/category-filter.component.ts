import { Component, EventEmitter, OnDestroy, OnInit, Output } from '@angular/core';
import { Subscription } from 'rxjs';
import { CatalogFilters } from 'src/app/core/models/catalog/catalog-filters';
import { CategoryListItem } from 'src/app/core/models/category/category-list-item';
import { CategoryService } from 'src/app/core/services/category.service';

@Component({
  selector: 'app-category-filter',
  templateUrl: './category-filter.component.html',
  styleUrls: ['./category-filter.component.scss'],
})
export class CategoryFilterComponent implements OnInit, OnDestroy {
  @Output() filterChange = new EventEmitter<CatalogFilters>();

  public categories: CategoryListItem[] = [];
  public isLoading: boolean = false;
  public isSaleSelected: boolean = false;

  private _selectedIds = new Set<string>();
  private _sub!: Subscription;

  constructor(private _categoryService: CategoryService) {}

  public ngOnInit(): void {
    this.isLoading = true;
    this._sub = this._categoryService.getCategories().subscribe({
      next: (categories) => {
        this.categories = categories;
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      },
    });
  }

  public ngOnDestroy(): void {
    this._sub?.unsubscribe();
  }

  public isSelected(id: string): boolean {
    return this._selectedIds.has(id);
  }

  public onToggle(id: string, checked: boolean): void {
    if (checked) {
      this._selectedIds.add(id);
    } else {
      this._selectedIds.delete(id);
    }
    this._emitChange();
  }

  public onSaleToggle(checked: boolean): void {
    this.isSaleSelected = checked;
    this._emitChange();
  }

  private _emitChange(): void {
    this.filterChange.emit({
      categoryIds: [...this._selectedIds],
      returnSpecificDiscountProducts: this.isSaleSelected,
    });
  }
}
