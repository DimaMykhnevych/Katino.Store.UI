export interface RegisterRequest {
  email: string;
  password: string;
  confirmPassword: string;
  clientUriForEmailConfirmation: string;
}
