import { Component, EventEmitter, OnDestroy, OnInit, Output } from '@angular/core';
import { Subscription } from 'rxjs';
import { CollectionListItem } from 'src/app/core/models/collection/collection-list-item';
import { CollectionService } from 'src/app/core/services/collection.service';

@Component({
  selector: 'app-collection-filter',
  templateUrl: './collection-filter.component.html',
  styleUrls: ['./collection-filter.component.scss'],
})
export class CollectionFilterComponent implements OnInit, OnDestroy {
  @Output() filterChange = new EventEmitter<string[]>();

  public collections: CollectionListItem[] = [];
  public isLoading: boolean = false;

  private _selectedIds = new Set<string>();
  private _sub!: Subscription;

  constructor(private _collectionService: CollectionService) {}

  public ngOnInit(): void {
    this.isLoading = true;
    this._sub = this._collectionService.getCollections().subscribe({
      next: (collections) => {
        this.collections = collections;
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
    this.filterChange.emit([...this._selectedIds]);
  }
}
