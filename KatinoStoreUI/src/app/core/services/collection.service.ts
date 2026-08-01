import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { AppSettings } from 'src/app/core/settings';
import { CollectionListItem } from '../models/collection/collection-list-item';

@Injectable({
  providedIn: 'root',
})
export class CollectionService {
  constructor(private _http: HttpClient) {}

  public getCollections(): Observable<CollectionListItem[]> {
    return this._http.get<CollectionListItem[]>(
      `${AppSettings.apiHost}/Collection`,
    );
  }
}
