import { Component, OnDestroy } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';
import { RouteConstants } from 'src/app/core/constants/route-constants';
import { CustomerAuthService } from 'src/app/core/auth/services/customer-auth.service';
import {
  apiErrorMessageKey,
  parseApiError,
} from 'src/app/core/http/errors/api-error';

// Same rule as PasswordStrengthRegex on the server; the server stays authoritative.
const PASSWORD_PATTERN =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{}|;:'",.<>/?]).{7,}$/;

const SERVER_FIELDS = ['email', 'password', 'confirmPassword'];

function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const password = group.get('password')?.value;
  const confirm = group.get('confirmPassword')?.value;
  return password && confirm && password !== confirm
    ? { passwordsDoNotMatch: true }
    : null;
}

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss'],
})
export class RegisterComponent implements OnDestroy {
  public readonly form: FormGroup;
  public readonly loginRoute = RouteConstants.login;
  public isSubmitting = false;
  public hidePassword = true;
  public formErrorKey: string | null = null;
  public registeredEmail: string | null = null;

  private readonly _destroy$ = new Subject<void>();

  constructor(fb: FormBuilder, private _auth: CustomerAuthService) {
    this.form = fb.group(
      {
        email: ['', [Validators.required, Validators.email]],
        password: ['', [Validators.required, Validators.pattern(PASSWORD_PATTERN)]],
        confirmPassword: ['', Validators.required],
      },
      { validators: passwordsMatch },
    );
  }

  public ngOnDestroy(): void {
    this.form.reset();
    this._destroy$.next();
    this._destroy$.complete();
  }

  // Server error code set on a field, shown under it until the user edits the field.
  public serverErrorKey(field: string): string | null {
    return this.form.get(field)?.getError('server') ?? null;
  }

  public submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const email: string = this.form.value.email.trim();
    this.isSubmitting = true;
    this.formErrorKey = null;

    this._auth
      .register({
        email,
        password: this.form.value.password,
        confirmPassword: this.form.value.confirmPassword,
        clientUriForEmailConfirmation: new URL(
          RouteConstants.emailConfirmation.substring(1),
          document.baseURI,
        ).toString(),
      })
      .pipe(
        finalize(() => (this.isSubmitting = false)),
        takeUntil(this._destroy$),
      )
      .subscribe({
        next: () => {
          this.registeredEmail = email;
          this.form.reset();
        },
        error: (error: unknown) => {
          const apiError = parseApiError(error);

          if (apiError.status === 429) {
            this.formErrorKey = 'apiErrors.tooManyAttempts';
            return;
          }

          const messageKey = apiErrorMessageKey(apiError);
          const control =
            apiError.field && SERVER_FIELDS.includes(apiError.field)
              ? this.form.get(apiError.field)
              : null;

          if (control && apiError.code) {
            control.setErrors({ server: messageKey });
            control.markAsTouched();
            return;
          }

          this.formErrorKey = messageKey;
        },
      });
  }
}
