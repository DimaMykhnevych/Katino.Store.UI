import { Component, OnInit } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit {
  title = 'KatinoStoreUI';

  constructor(private _translate: TranslateService) {}

  public ngOnInit() {
    let lang = localStorage.getItem('language');
    if (lang === null) {
      lang = 'ua';
      localStorage.setItem('language', lang);
    }

    this._translate.setDefaultLang(lang);
    this._translate.use(lang);
  }
}
