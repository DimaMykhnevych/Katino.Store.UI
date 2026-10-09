import { LoginErrorCode } from '../../enums/login-error-code';

export interface LoginOutcome {
  loginErrorCode: LoginErrorCode;
  cartMergeFailed: boolean;
}
