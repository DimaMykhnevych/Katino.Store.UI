import { Component, OnInit } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { LanguageConstants } from './core/constants/language-constants';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit {
  title = 'KatinoStoreUI';

  constructor(private _translate: TranslateService) {}

  public ngOnInit() {
    let lang = localStorage.getItem(LanguageConstants.LanguageLocalStorageKey);
    if (lang === null) {
      lang = LanguageConstants.UaLang;
      localStorage.setItem(LanguageConstants.LanguageLocalStorageKey, lang);
    }

    this._translate.setDefaultLang(lang);
    this._translate.use(lang);
  }
}
