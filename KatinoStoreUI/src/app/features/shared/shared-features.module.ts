import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from 'src/app/layout/material';
import { ProductCardComponent } from './components/product-card/product-card.component';
import { PaginationComponent } from './components/pagination/pagination.component';

@NgModule({
  declarations: [ProductCardComponent, PaginationComponent],
  imports: [CommonModule, MaterialModule],
  exports: [ProductCardComponent, PaginationComponent],
})
export class SharedFeaturesModule {}
