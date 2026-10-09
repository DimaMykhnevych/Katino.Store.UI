import { HttpErrorResponse } from '@angular/common/http';
import { apiErrorMessageKey, parseApiError } from './api-error';

function httpError(status: number, body: unknown = null): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: body });
}

describe('api-error', () => {
  it('reads the first code of the first field from a ValidationProblem', () => {
    const error = parseApiError(
      httpError(409, { errors: { quantity: ['cartItemLimitExceeded'] } }),
    );

    expect(error).toEqual({
      status: 409,
      field: 'quantity',
      code: 'cartItemLimitExceeded',
    });
    expect(apiErrorMessageKey(error)).toBe('apiErrors.cartItemLimitExceeded');
  });

  it('has no code for errors without a body (401, 500, network)', () => {
    expect(parseApiError(httpError(401))).toEqual({
      status: 401,
      field: null,
      code: null,
    });
    expect(apiErrorMessageKey(parseApiError(httpError(500)))).toBe(
      'apiErrors.generic',
    );
    expect(apiErrorMessageKey(parseApiError(httpError(0)))).toBe(
      'apiErrors.network',
    );
  });

  it('maps 429 to the rate-limit message', () => {
    expect(apiErrorMessageKey(parseApiError(httpError(429)))).toBe(
      'apiErrors.tooManyRequests',
    );
  });

  it('falls back to the generic message for an unknown code and logs only the code', () => {
    const warn = spyOn(console, 'warn');
    const error = parseApiError(
      httpError(409, { errors: { items: ['somethingNew'] } }),
    );

    expect(apiErrorMessageKey(error)).toBe('apiErrors.generic');
    expect(warn).toHaveBeenCalledWith('Unknown API error code:', 'somethingNew');
  });
});
