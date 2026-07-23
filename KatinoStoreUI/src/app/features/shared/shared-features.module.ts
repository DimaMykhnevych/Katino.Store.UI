import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { MaterialModule } from 'src/app/layout/material';
import { ProductCardComponent } from './components/product-card/product-card.component';
import { PaginationComponent } from './components/pagination/pagination.component';

@NgModule({
  declarations: [ProductCardComponent, PaginationComponent],
  imports: [CommonModule, MaterialModule, TranslateModule],
  exports: [ProductCardComponent, PaginationComponent],
})
export class SharedFeaturesModule {}
