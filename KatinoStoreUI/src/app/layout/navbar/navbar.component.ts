import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DateAdapter } from '@angular/material/core';
import { TranslateService } from '@ngx-translate/core';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { LanguageConstants } from 'src/app/core/constants/language-constants';

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

  private _searchSubject = new Subject<string>();
  private _searchSub!: Subscription;
  private _querySub!: Subscription;

  constructor(
    private _translate: TranslateService,
    private _dateAdapter: DateAdapter<Date>,
    private _router: Router,
    private _route: ActivatedRoute,
  ) {}

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
    this._router.navigate(['/main'], {
      queryParams: { search: query || null },
    });
  }
}
