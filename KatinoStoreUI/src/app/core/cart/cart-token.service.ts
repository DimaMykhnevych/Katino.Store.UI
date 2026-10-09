import { Injectable } from '@angular/core';
import { StorageKeys } from '../constants/storage-keys';
import { readStorage, removeStorage, writeStorage } from '../http/storage.util';

// Guest cart token. It is a bearer credential for the cart: never log it, never put it in a URL.
@Injectable({
  providedIn: 'root',
})
export class CartTokenService {
  public get token(): string | null {
    return readStorage(StorageKeys.CartToken);
  }

  public set token(value: string | null) {
    if (value) {
      writeStorage(StorageKeys.CartToken, value);
      return;
    }

    removeStorage(StorageKeys.CartToken);
  }
}
