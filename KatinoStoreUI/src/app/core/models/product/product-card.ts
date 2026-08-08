import { ProductCardCategory } from '../category/product-card-category';
import { ProductCardVariant } from '../product-variant/product-card-variant';

export interface ProductCard {
  id: string;
  name: string;
  description: string;
  category: ProductCardCategory;
  price: number;
  hasDiscount: boolean;
  discountPrice: number | null;
  variants: ProductCardVariant[];
}
