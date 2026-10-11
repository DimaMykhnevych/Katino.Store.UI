import { Credentials, env } from './env';
import { record, reserve } from './rate-budget';

export interface Variant {
  id: string;
  status: number;
  availableQuantity: number;
  size: { id: string; name: string };
  color: { id: string; name: string; hexCode: string };
}

export interface Product {
  id: string;
  name: string;
  price: number;
  hasDiscount: boolean;
  discountPrice: number | null;
  variants: Variant[];
}

export interface CartItem {
  id: string;
  productVariantId: string;
  productName: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  discountAmount: number;
  finalLineTotal: number;
  availableQuantity: number;
  backorderQuantity: number;
  reservationExpiresAt: string;
}

export interface Cart {
  id: string;
  cartToken: string | null;
  items: CartItem[];
  baseTotal: number;
  totalDiscount: number;
  totalPrice: number;
  removedExpiredItems: CartItem[];
}

const DISCONTINUED = 3;
const IN_STOCK = 1;

export async function callApi<T>(
  path: string,
  init: { method?: string; headers?: Record<string, string>; body?: unknown } = {},
): Promise<{ status: number; body: T }> {
  const method = init.method ?? 'GET';
  const url = `${env.apiUrl}${path}`;
  await reserve({ any: 1, ...(path.startsWith('/CustomerAuth') ? { auth: 1 } : {}) });
  record(url, method);
  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...init.headers },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const text = await response.text();
  return { status: response.status, body: (text ? JSON.parse(text) : null) as T };
}

// Products the tests use. The product page preselects the first variant, so that is the one checked.
export interface TestData {
  plain: Product;
  other: Product;
  discounted?: Product;
  // First variant in stock with fewer than 10 pieces, so 10 in the cart is partly made to order.
  lowStock?: Product;
}

export async function pickTestData(): Promise<TestData> {
  const list = await callApi<{ items: { id: string }[] }>('/Product?pageNumber=1&pageSize=20');
  const products: Product[] = [];
  for (const { id } of list.body.items) {
    products.push((await callApi<Product>(`/Product/${id}`)).body);
  }

  const purchasable = products.filter((p) => p.variants[0] && p.variants[0].status !== DISCONTINUED);
  const plainOnes = purchasable.filter((p) => !p.hasDiscount);
  const plain = plainOnes[0] ?? purchasable[0];
  const other = purchasable.find((p) => p !== plain);
  if (!plain || !other) {
    throw new Error('The catalog needs at least two products whose first variant can be bought.');
  }

  const lowStock = purchasable
    .filter((p) => p.variants[0].status === IN_STOCK && p.variants[0].availableQuantity < 10)
    .sort((a, b) => a.variants[0].availableQuantity - b.variants[0].availableQuantity)[0];

  return { plain, other, discounted: purchasable.find((p) => p.hasDiscount), lowStock };
}

export async function guestCart(cartToken: string): Promise<Cart> {
  return (await callApi<Cart>('/Cart', { headers: { 'X-Cart-Token': cartToken } })).body;
}

// Empties a customer's cart on the server, so a test knows exactly what it should contain.
export async function clearCustomerCart(customer: Credentials): Promise<void> {
  const login = await callApi<{ token: string; loginErrorCode: number }>('/CustomerAuth/token', {
    method: 'POST',
    body: customer,
  });
  if (login.body?.loginErrorCode !== 100) {
    throw new Error(`Cannot log in as ${customer.email} (HTTP ${login.status})`);
  }
  const headers = { Authorization: `Bearer ${login.body.token}` };
  const cart = await callApi<Cart>('/Cart', { headers });
  for (const item of cart.body.items) {
    await reserve({ cartWrite: 1 });
    await callApi(`/Cart/items/${item.id}`, { method: 'DELETE', headers });
  }
}

// Epoch ms when a JWT expires (payload read only, signature not checked).
export function jwtExpiresAt(token: string): number {
  const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(Buffer.from(payload, 'base64').toString('utf-8')).exp * 1000;
}
