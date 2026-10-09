import { HttpErrorResponse } from '@angular/common/http';

export interface ApiError {
  status: number;
  field: string | null;
  code: string | null;
}

// Codes the backend documents (storefront-frontend-handoff.md, sections 3, 4 and 6).
// Each one has a translation under "apiErrors.<code>".
const KNOWN_CODES = new Set<string>([
  'cartItemLimitExceeded',
  'cartItemsLimitExceeded',
  'variantNotPurchasable',
  'quantityMustBePositive',
  'cartNotFound',
  'cartItemNotFound',
  'emailRequired',
  'emailInvalidFormat',
  'emailAlreadyTaken',
  'passwordRequired',
  'confirmPasswordRequired',
  'passwordMismatch',
  'passwordTooWeak',
  'emailConfirmationTokenInvalid',
]);

export function parseApiError(error: unknown): ApiError {
  if (!(error instanceof HttpErrorResponse)) {
    return { status: -1, field: null, code: null };
  }

  const errors = error.error?.errors;
  if (errors && typeof errors === 'object') {
    const field = Object.keys(errors)[0];
    const value = field ? errors[field] : null;
    const code = Array.isArray(value) && typeof value[0] === 'string' ? value[0] : null;

    return { status: error.status, field: field ?? null, code };
  }

  return { status: error.status, field: null, code: null };
}

// Translation key for an error. Unknown codes fall back to a generic message and the code is logged
// (only the code: request bodies and headers carry tokens and passwords).
export function apiErrorMessageKey(error: ApiError): string {
  if (error.code && KNOWN_CODES.has(error.code)) {
    return `apiErrors.${error.code}`;
  }

  if (error.code) {
    console.warn('Unknown API error code:', error.code);
  }

  if (error.status === 429) {
    return 'apiErrors.tooManyRequests';
  }

  if (error.status === 0) {
    return 'apiErrors.network';
  }

  return 'apiErrors.generic';
}
