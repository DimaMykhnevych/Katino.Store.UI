import { ProductListItem } from './product-list-item';

export interface GetProductsResponse {
  items: ProductListItem[];
  totalCount: number;
}
