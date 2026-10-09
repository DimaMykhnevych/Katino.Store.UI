import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { MaterialModule } from 'src/app/layout/material';
import { SpinnerModule } from 'src/app/layout/spinner/spinner.module';
import { CartComponent } from './cart.component';
import { CartLineComponent } from './components/cart-line/cart-line.component';
import { CartSummaryComponent } from './components/cart-summary/cart-summary.component';
import { ReservationCountdownComponent } from './components/reservation-countdown/reservation-countdown.component';

@NgModule({
  declarations: [
    CartComponent,
    CartLineComponent,
    CartSummaryComponent,
    ReservationCountdownComponent,
  ],
  imports: [
    CommonModule,
    RouterModule,
    MaterialModule,
    TranslateModule,
    SpinnerModule,
  ],
})
export class CartModule {}
