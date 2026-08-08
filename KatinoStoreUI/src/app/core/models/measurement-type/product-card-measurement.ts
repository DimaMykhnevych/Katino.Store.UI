import { ProductCardMeasurementType } from './product-card-measurement-type';

export interface ProductCardMeasurement {
  id: string;
  value: string;
  measurementType: ProductCardMeasurementType;
}
