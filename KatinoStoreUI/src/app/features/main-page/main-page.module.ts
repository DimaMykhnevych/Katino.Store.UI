import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from 'src/app/layout/material';
import { CoreModule } from 'src/app/core/core.module';
import { TranslateModule } from '@ngx-translate/core';
import { MainPageComponent } from './main-page.component';
import { ProductCardComponent } from './components/product-card/product-card.component';
import { ProductListComponent } from './components/product-list/product-list.component';

@NgModule({
  declarations: [MainPageComponent, ProductCardComponent, ProductListComponent],
  imports: [CommonModule, MaterialModule, CoreModule, TranslateModule],
})
export class MainPageModule {}
