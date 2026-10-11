// All credentials come from the environment; nothing secret is stored in the repository.
function optional(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : undefined;
}

export interface Credentials {
  email: string;
  password: string;
}

function credentials(emailVar: string, passwordVar: string): Credentials | undefined {
  const email = optional(emailVar);
  const password = optional(passwordVar);
  return email && password ? { email, password } : undefined;
}

export const env = {
  baseUrl: optional('E2E_BASE_URL') ?? 'http://localhost:4200',
  // Used by the tests themselves (test data, server-side checks). The app uses its own environment.ts.
  apiUrl: optional('E2E_API_URL') ?? 'http://localhost:5088/api',
  // A customer with a confirmed email.
  customer: credentials('E2E_CUSTOMER_EMAIL', 'E2E_CUSTOMER_PASSWORD'),
  // A second confirmed customer, for the account switch between tabs.
  secondCustomer: credentials('E2E_SECOND_CUSTOMER_EMAIL', 'E2E_SECOND_CUSTOMER_PASSWORD'),
  // Registration sends a real email. "{n}" is replaced with a timestamp, e.g. name+katino{n}@gmail.com.
  registerEmail: optional('E2E_REGISTER_EMAIL'),
  // A fresh link from a confirmation email; it works once.
  confirmLink: optional('E2E_CONFIRM_LINK'),
};
