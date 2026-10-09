import { ProductCardColor } from '../color/product-card-color';
import { ProductCardSize } from '../size/product-card-size';

export interface CartItem {
  id: string;
  productVariantId: string;
  productId: string;
  productName: string | null;
  article: string | null;
  size: ProductCardSize | null;
  color: ProductCardColor | null;
  photoUrl: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  discountAmount: number;
  finalLineTotal: number;
  availableQuantity: number;
  backorderQuantity: number;
  reservationExpiresAt: string;
}
