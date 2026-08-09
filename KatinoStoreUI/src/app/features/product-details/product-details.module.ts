import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { MaterialModule } from 'src/app/layout/material';
import { SpinnerModule } from 'src/app/layout/spinner/spinner.module';
import { ProductDetailsComponent } from './product-details.component';
import { ProductGalleryComponent } from './components/product-gallery/product-gallery.component';
import { ColorSelectorComponent } from './components/color-selector/color-selector.component';
import { SizeSelectorComponent } from './components/size-selector/size-selector.component';
import { ProductMeasurementsComponent } from './components/product-measurements/product-measurements.component';

@NgModule({
  declarations: [
    ProductDetailsComponent,
    ProductGalleryComponent,
    ColorSelectorComponent,
    SizeSelectorComponent,
    ProductMeasurementsComponent,
  ],
  imports: [
    CommonModule,
    RouterModule,
    MaterialModule,
    TranslateModule,
    SpinnerModule,
  ],
})
export class ProductDetailsModule {}
