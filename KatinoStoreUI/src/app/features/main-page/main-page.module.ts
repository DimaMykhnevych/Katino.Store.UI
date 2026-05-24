import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from 'src/app/layout/material';
import { CoreModule } from 'src/app/core/core.module';
import { TranslateModule } from '@ngx-translate/core';
import { MainPageComponent } from './main-page.component';

@NgModule({
  declarations: [MainPageComponent],
  imports: [CommonModule, MaterialModule, CoreModule, TranslateModule],
})
export class MainPageModule {}
