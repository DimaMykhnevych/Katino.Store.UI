import { ProductColor } from './product-color';

export interface ProductListItem {
  id: string;
  name: string;
  description: string;
  categoryId: string;
  price: number;
  photoUrl: string;
  colors: ProductColor[];
}
