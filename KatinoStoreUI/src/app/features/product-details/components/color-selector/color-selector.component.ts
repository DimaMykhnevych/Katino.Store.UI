import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ProductCardColor } from 'src/app/core/models/color/product-card-color';

@Component({
  selector: 'app-color-selector',
  templateUrl: './color-selector.component.html',
  styleUrls: ['./color-selector.component.scss'],
})
export class ColorSelectorComponent {
  @Input() colors: ProductCardColor[] = [];
  @Input() selectedColorId: string | null = null;
  @Output() colorSelected = new EventEmitter<string>();

  public get selectedColorName(): string {
    return this.colors.find((c) => c.id === this.selectedColorId)?.name ?? '';
  }

  public onSelect(color: ProductCardColor): void {
    if (color.id === this.selectedColorId) {
      return;
    }

    this.colorSelected.emit(color.id);
  }
}
