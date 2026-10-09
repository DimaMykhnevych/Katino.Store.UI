import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { MaterialModule } from 'src/app/layout/material';
import { SpinnerModule } from 'src/app/layout/spinner/spinner.module';
import { LoginComponent } from './login/login.component';
import { RegisterComponent } from './register/register.component';
import { EmailConfirmationComponent } from './email-confirmation/email-confirmation.component';
import { SupportHintComponent } from './support-hint/support-hint.component';

@NgModule({
  declarations: [
    LoginComponent,
    RegisterComponent,
    EmailConfirmationComponent,
    SupportHintComponent,
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    MaterialModule,
    TranslateModule,
    SpinnerModule,
  ],
})
export class AuthPagesModule {}
