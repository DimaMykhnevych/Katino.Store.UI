import { Injectable } from '@angular/core';
import { StorageKeys } from '../../constants/storage-keys';
import {
  readStorage,
  removeStorage,
  writeStorage,
} from '../../http/storage.util';

// Customer JWT. Never log it, never put it in a URL.
@Injectable({
  providedIn: 'root',
})
export class CustomerTokenService {
  public get token(): string | null {
    return readStorage(StorageKeys.CustomerToken);
  }

  public set token(value: string | null) {
    if (value) {
      writeStorage(StorageKeys.CustomerToken, value);
      return;
    }

    removeStorage(StorageKeys.CustomerToken);
  }

  // UX-only check: the server is authoritative and answers 401 for an expired token anyway.
  // A token whose payload can't be read is left for the server to judge.
  public isExpired(token: string): boolean {
    const exp = this._readExp(token);
    return exp !== null && exp * 1000 <= Date.now();
  }

  private _readExp(token: string): number | null {
    const payload = token.split('.')[1];
    if (!payload) {
      return null;
    }

    try {
      const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
      const exp = JSON.parse(json)?.exp;
      return typeof exp === 'number' ? exp : null;
    } catch {
      return null;
    }
  }
}
