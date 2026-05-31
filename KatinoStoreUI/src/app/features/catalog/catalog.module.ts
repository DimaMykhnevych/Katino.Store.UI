import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MaterialModule } from 'src/app/layout/material';
import { CoreModule } from 'src/app/core/core.module';
import { TranslateModule } from '@ngx-translate/core';
import { SharedFeaturesModule } from '../shared/shared-features.module';
import { SpinnerModule } from 'src/app/layout/spinner/spinner.module';
import { CatalogComponent } from './catalog.component';
import { CatalogProductListComponent } from './components/product-list/product-list.component';

@NgModule({
  declarations: [CatalogComponent, CatalogProductListComponent],
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
export class CatalogModule {}
