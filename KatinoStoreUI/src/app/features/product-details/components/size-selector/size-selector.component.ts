import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ProductCardSize } from 'src/app/core/models/size/product-card-size';

@Component({
  selector: 'app-size-selector',
  templateUrl: './size-selector.component.html',
  styleUrls: ['./size-selector.component.scss'],
})
export class SizeSelectorComponent {
  @Input() sizes: ProductCardSize[] = [];
  @Input() selectedSizeId: string | null = null;
  @Input() availableSizeIds: string[] = [];
  @Output() sizeSelected = new EventEmitter<string>();

  public get selectedSizeName(): string {
    return this.sizes.find((s) => s.id === this.selectedSizeId)?.name ?? '';
  }

  public isAvailable(size: ProductCardSize): boolean {
    return this.availableSizeIds.includes(size.id);
  }

  public onSelect(size: ProductCardSize): void {
    if (size.id === this.selectedSizeId || !this.isAvailable(size)) {
      return;
    }

    this.sizeSelected.emit(size.id);
  }
}
