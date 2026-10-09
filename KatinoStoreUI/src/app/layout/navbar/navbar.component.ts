import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DateAdapter } from '@angular/material/core';
import { TranslateService } from '@ngx-translate/core';
import { Observable, Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { LanguageConstants } from 'src/app/core/constants/language-constants';
import { RouteConstants } from 'src/app/core/constants/route-constants';
import { CartService } from 'src/app/core/cart/cart.service';
import {
  AuthState,
  CustomerAuthService,
} from 'src/app/core/auth/services/customer-auth.service';

// Pages a login should not return to.
const AUTH_ROUTES = [
  RouteConstants.login,
  RouteConstants.register,
  RouteConstants.emailConfirmation,
];

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss'],
})
export class NavbarComponent implements OnInit, OnDestroy {
  public mobileMenuOpen = false;
  public uaLang: string = LanguageConstants.UaLang;
  public enLang: string = LanguageConstants.EnLang;
  public searchQuery: string = '';
  public readonly cartRoute = RouteConstants.cart;
  public readonly loginRoute = RouteConstants.login;
  public readonly itemsCount$: Observable<number>;
  public readonly auth$: Observable<AuthState>;

  private _searchSubject = new Subject<string>();
  private _searchSub!: Subscription;
  private _querySub!: Subscription;

  constructor(
    private _translate: TranslateService,
    private _dateAdapter: DateAdapter<Date>,
    private _router: Router,
    private _route: ActivatedRoute,
    private _auth: CustomerAuthService,
    cartService: CartService,
  ) {
    this.itemsCount$ = cartService.itemsCount$;
    this.auth$ = this._auth.state$;
  }

  public get loginQueryParams(): { returnUrl: string } | null {
    const url = this._router.url;
    return AUTH_ROUTES.some((route) => url.startsWith(route))
      ? null
      : { returnUrl: url };
  }

  public get currentLanguage(): string | null {
    return (
      localStorage.getItem(LanguageConstants.LanguageLocalStorageKey) ??
      LanguageConstants.UaLang
    );
  }

  public ngOnInit(): void {
    this._searchSub = this._searchSubject
      .pipe(debounceTime(400), distinctUntilChanged())
      .subscribe((query) => this.navigate(query));

    this._querySub = this._route.queryParams.subscribe((params) => {
      this.searchQuery = params['search'] || '';
    });
  }

  public ngOnDestroy(): void {
    this._searchSub?.unsubscribe();
    this._querySub?.unsubscribe();
    this._searchSubject.complete();
  }

  public setLanguage(language: string): void {
    localStorage.setItem(LanguageConstants.LanguageLocalStorageKey, language);
    this._translate.setDefaultLang(language);
    this._translate.use(language);

    if (language === LanguageConstants.UaLang) {
      this._dateAdapter.setLocale(LanguageConstants.UaLocale);
      return;
    }

    if (language === LanguageConstants.EnLang) {
      this._dateAdapter.setLocale(LanguageConstants.EnLocale);
      return;
    }
  }

  public logout(): void {
    this.mobileMenuOpen = false;
    this._auth.logout();
  }

  public toggleMobileMenu(): void {
    this.mobileMenuOpen = !this.mobileMenuOpen;
  }

  public onInput(value: string): void {
    this._searchSubject.next(value);
  }

  public onSearch(value: string): void {
    this._searchSubject.next('');
    this.navigate(value);
  }

  private navigate(query: string): void {
    this._router.navigate(['/catalog'], {
      queryParams: { search: query || null },
    });
  }
}
