import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { AppSettings } from 'src/app/core/settings';
import { GetProductsRequest } from '../models/product/get-products-request';
import { GetProductsResponse } from '../models/product/get-products-response';
import { convertToHttpParams } from '../http/request/http-params.util';

@Injectable({
  providedIn: 'root',
})
export class ProductService {
  constructor(private _http: HttpClient) {}

  public getProductsForMainPage(
    request: GetProductsRequest,
  ): Observable<GetProductsResponse> {
    const httpParams: HttpParams =
      convertToHttpParams<GetProductsRequest>(request);
    return this._http.get<GetProductsResponse>(
      `${AppSettings.apiHost}/Product`,
      {
        params: httpParams,
      },
    );
  }
}
