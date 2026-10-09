import { LoginErrorCode } from '../../enums/login-error-code';
import { CustomerInfo } from './customer-info';

export interface CustomerAuthResult {
  token: string | null;
  isAuthorized: boolean;
  customerInfo: CustomerInfo | null;
  loginErrorCode: LoginErrorCode;
  cartMerged: boolean | null;
}
