import { CartItem } from './cart-item';

export const EMPTY_GUID = '00000000-0000-0000-0000-000000000000';

export interface Cart {
  id: string;
  cartToken: string | null;
  items: CartItem[] | null;
  baseTotal: number;
  totalDiscount: number;
  totalPrice: number;
  removedExpiredItems: CartItem[] | null;
}

export function createEmptyCart(): Cart {
  return {
    id: EMPTY_GUID,
    cartToken: null,
    items: [],
    baseTotal: 0,
    totalDiscount: 0,
    totalPrice: 0,
    removedExpiredItems: null,
  };
}
