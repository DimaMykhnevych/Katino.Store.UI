import { Component, Input } from '@angular/core';
import { ProductCardMeasurement } from 'src/app/core/models/measurement-type/product-card-measurement';

@Component({
  selector: 'app-product-measurements',
  templateUrl: './product-measurements.component.html',
  styleUrls: ['./product-measurements.component.scss'],
})
export class ProductMeasurementsComponent {
  @Input() measurements: ProductCardMeasurement[] = [];

  public get hasMeasurements(): boolean {
    return this.measurements.some((m) => m.value);
  }

  public getLines(value: string | null): string[] {
    return value ? value.split(/\r\n|\n/) : [];
  }
}
