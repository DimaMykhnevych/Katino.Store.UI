import { ProductVariantStatus } from '../../enums/product-variant-status';
import { ProductCardColor } from '../color/product-card-color';
import { ProductCardMeasurement } from '../measurement-type/product-card-measurement';
import { ProductCardPhoto } from '../product-photo/product-card-photo';
import { ProductCardSize } from '../size/product-card-size';

export interface ProductCardVariant {
  id: string;
  size: ProductCardSize;
  color: ProductCardColor;
  status: ProductVariantStatus;
  article: string;
  availableQuantity: number;
  photos: ProductCardPhoto[];
  measurements: ProductCardMeasurement[];
}
