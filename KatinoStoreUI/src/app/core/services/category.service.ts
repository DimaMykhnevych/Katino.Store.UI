import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { AppSettings } from 'src/app/core/settings';
import { CategoryListItem } from '../models/category/category-list-item';

@Injectable({
  providedIn: 'root',
})
export class CategoryService {
  constructor(private _http: HttpClient) {}

  public getCategories(): Observable<CategoryListItem[]> {
    return this._http.get<CategoryListItem[]>(
      `${AppSettings.apiHost}/Category`,
    );
  }
}
