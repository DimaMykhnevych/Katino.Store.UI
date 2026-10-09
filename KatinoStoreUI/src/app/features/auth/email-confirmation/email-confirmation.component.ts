import { Location } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { RouteConstants } from 'src/app/core/constants/route-constants';
import { CustomerAuthService } from 'src/app/core/auth/services/customer-auth.service';
import { ConfirmEmailRequest } from 'src/app/core/auth/models/confirm-email-request';
import {
  apiErrorMessageKey,
  parseApiError,
} from 'src/app/core/http/errors/api-error';

type ConfirmationStatus = 'confirming' | 'confirmed' | 'invalidLink' | 'missingParams' | 'failed';

@Component({
  selector: 'app-email-confirmation',
  templateUrl: './email-confirmation.component.html',
  styleUrls: ['./email-confirmation.component.scss'],
})
export class EmailConfirmationComponent implements OnInit, OnDestroy {
  public readonly loginRoute = RouteConstants.login;
  public status: ConfirmationStatus = 'confirming';
  public errorKey: string | null = null;

  // Kept only in memory, so "try again" works after the address bar was cleaned.
  private _request: ConfirmEmailRequest | null = null;
  private readonly _destroy$ = new Subject<void>();

  constructor(
    private _route: ActivatedRoute,
    private _location: Location,
    private _auth: CustomerAuthService,
  ) {}

  public ngOnInit(): void {
    const params = this._route.snapshot.queryParamMap;
    const email = params.get('email');
    const token = params.get('token');

    // The link's token and email must not stay in the address bar or the history.
    this._location.replaceState(RouteConstants.emailConfirmation);

    if (!email || !token) {
      this.status = 'missingParams';
      return;
    }

    this._request = { email, token };
    this.confirm();
  }

  public ngOnDestroy(): void {
    this._request = null;
    this._destroy$.next();
    this._destroy$.complete();
  }

  public confirm(): void {
    if (!this._request) {
      return;
    }

    this.status = 'confirming';
    this.errorKey = null;

    this._auth
      .confirmEmail(this._request)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: () => {
          this.status = 'confirmed';
          this._request = null;
        },
        error: (error: unknown) => {
          const apiError = parseApiError(error);

          if (apiError.code === 'emailConfirmationTokenInvalid') {
            this.status = 'invalidLink';
            this._request = null;
            return;
          }

          this.status = 'failed';
          this.errorKey =
            apiError.status === 429
              ? 'apiErrors.tooManyAttempts'
              : apiErrorMessageKey(apiError);
        },
      });
  }
}
