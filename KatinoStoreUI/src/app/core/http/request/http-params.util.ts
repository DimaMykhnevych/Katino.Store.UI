import { HttpParams } from '@angular/common/http';

export function convertToHttpParams<T = object>(params: T): HttpParams {
  let httpParams = new HttpParams();

  Object.keys(params as any).forEach((key) => {
    const value = (params as any)[key];

    if (value === null || value === undefined) return;

    if (Array.isArray(value)) {
      if (value.length === 0) return;

      value.forEach((v) => {
        if (v === null || v === undefined) return;
        httpParams = httpParams.append(key, String(v));
      });

      return;
    }

    httpParams = httpParams.append(key, String(value));
  });

  return httpParams;
}
