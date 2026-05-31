export interface GetProductsRequest {
  search?: string;
  page: number;
  pageSize: number;
  categoryIds: string[];
}
