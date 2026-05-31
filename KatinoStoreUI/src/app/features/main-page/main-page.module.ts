import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MaterialModule } from 'src/app/layout/material';
import { CoreModule } from 'src/app/core/core.module';
import { TranslateModule } from '@ngx-translate/core';
import { SharedFeaturesModule } from '../shared/shared-features.module';
import { MainPageComponent } from './main-page.component';
import { ProductListComponent } from './components/product-list/product-list.component';
import { SpinnerModule } from 'src/app/layout/spinner/spinner.module';

@NgModule({
  declarations: [MainPageComponent, ProductListComponent],
  imports: [
    CommonModule,
    RouterModule,
    MaterialModule,
    CoreModule,
    TranslateModule,
    SharedFeaturesModule,
    SpinnerModule,
  ],
})
export class MainPageModule {}
