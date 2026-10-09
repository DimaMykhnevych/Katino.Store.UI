import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { ToastrService } from 'ngx-toastr';
import { Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';
import { RouteConstants } from 'src/app/core/constants/route-constants';
import { LoginErrorCode } from 'src/app/core/enums/login-error-code';
import { CustomerAuthService } from 'src/app/core/auth/services/customer-auth.service';
import { LoginOutcome } from 'src/app/core/auth/models/login-outcome';
import { safeReturnUrl } from 'src/app/core/auth/return-url';
import { apiErrorMessageKey, parseApiError } from 'src/app/core/http/errors/api-error';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent implements OnInit, OnDestroy {
  public readonly form: FormGroup;
  public readonly registerRoute = RouteConstants.register;
  public isSubmitting = false;
  public hidePassword = true;
  public formErrorKey: string | null = null;
  public showSupportHint = false;

  private _returnUrl: string = RouteConstants.main;
  private readonly _destroy$ = new Subject<void>();

  constructor(
    fb: FormBuilder,
    private _auth: CustomerAuthService,
    private _route: ActivatedRoute,
    private _router: Router,
    private _toastr: ToastrService,
    private _translate: TranslateService,
  ) {
    this.form = fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
    });
  }

  public ngOnInit(): void {
    this._returnUrl = safeReturnUrl(
      this._route.snapshot.queryParamMap.get('returnUrl'),
    );

    if (this._auth.state.isLoggedIn) {
      this._router.navigateByUrl(this._returnUrl);
    }
  }

  // Drop the typed password when leaving the page.
  public ngOnDestroy(): void {
    this.form.reset();
    this._destroy$.next();
    this._destroy$.complete();
  }

  public submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    this.formErrorKey = null;
    this.showSupportHint = false;

    this._auth
      .login({
        email: this.form.value.email.trim(),
        password: this.form.value.password,
      })
      .pipe(
        finalize(() => (this.isSubmitting = false)),
        takeUntil(this._destroy$),
      )
      .subscribe({
        next: (outcome) => this._handleOutcome(outcome),
        error: (error: unknown) => {
          const apiError = parseApiError(error);
          this.formErrorKey =
            apiError.status === 429
              ? 'apiErrors.tooManyAttempts'
              : apiErrorMessageKey(apiError);
        },
      });
  }

  private _handleOutcome(outcome: LoginOutcome): void {
    switch (outcome.loginErrorCode) {
      case LoginErrorCode.none:
        if (outcome.cartMergeFailed) {
          this._toastr.warning(this._translate.instant('cart.mergeFailed'), '', {
            timeOut: 10000,
          });
        }
        this._router.navigateByUrl(this._returnUrl);
        return;
      case LoginErrorCode.emailConfirmationRequired:
        this.formErrorKey = 'auth.emailConfirmationRequired';
        this.showSupportHint = true;
        return;
      default:
        this.formErrorKey = 'auth.invalidCredentials';
        this.form.get('password')?.reset();
    }
  }
}
