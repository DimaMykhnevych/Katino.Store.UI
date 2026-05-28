import { LOCALE_ID, NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { ToastrModule } from 'ngx-toastr';
import { CoreModule } from './core/core.module';
import { DateAdapter } from '@angular/material/core';
import { AppDateAdapter } from './core/adapters/app-date-adapter';
import { MaterialModule } from './layout/material';
import { NavbarModule } from './layout/navbar/navbar.module';
import { MainPageModule } from './features/main-page/main-page.module';
import { CatalogModule } from './features/catalog/catalog.module';
import { SharedFeaturesModule } from './features/shared/shared-features.module';

@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule,
    AppRoutingModule,
    BrowserAnimationsModule,
    MaterialModule,
    HttpClientModule,
    TranslateModule.forRoot({
      loader: {
        provide: TranslateLoader,
        useFactory: (http: HttpClient) =>
          new TranslateHttpLoader(http, './assets/i18n/', '.json'),
        deps: [HttpClient],
      },
    }),
    ToastrModule.forRoot(),
    CoreModule,
    NavbarModule,
    MainPageModule,
    CatalogModule,
    SharedFeaturesModule,
  ],
  providers: [
    { provide: LOCALE_ID, useValue: 'uk' },
    { provide: DateAdapter, useClass: AppDateAdapter },
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
