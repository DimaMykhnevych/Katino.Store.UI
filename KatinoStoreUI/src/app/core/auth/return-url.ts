import { RouteConstants } from '../constants/route-constants';

// Only same-app paths: "/cart" yes, "//evil.com" or "https://..." no.
export function safeReturnUrl(value: string | null | undefined): string {
  if (value && value.startsWith('/') && !value.startsWith('//')) {
    return value;
  }

  return RouteConstants.main;
}
