import { Component, OnInit, OnDestroy } from '@angular/core';
import { DateAdapter } from '@angular/material/core';
import { TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
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

  private langSub!: Subscription;

  constructor(
    private _translate: TranslateService,
    private _dateAdapter: DateAdapter<Date>,
  ) {}

  public get currentLanguage(): string | null {
    return (
      localStorage.getItem(LanguageConstants.LanguageLocalStorageKey) ??
      LanguageConstants.UaLang
    );
  }

  public ngOnInit(): void {}

  public ngOnDestroy(): void {
    this.langSub?.unsubscribe();
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
}
