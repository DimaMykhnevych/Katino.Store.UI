import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavbarComponent } from './navbar.component';
import { AppRoutingModule } from 'src/app/app-routing.module';
import { MaterialModule } from '../material';
import { CoreModule } from 'src/app/core/core.module';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

@NgModule({
  declarations: [NavbarComponent],
  imports: [
    CommonModule,
    AppRoutingModule,
    MaterialModule,
    CoreModule,
    RouterModule,
    TranslateModule,
  ],
  exports: [NavbarComponent],
})
export class NavbarModule {}
