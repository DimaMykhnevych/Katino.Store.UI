import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AppSettings } from 'src/app/core/settings';

// No resend endpoint yet: a user whose confirmation email is missing or expired is pointed to support.
@Component({
  selector: 'app-support-hint',
  templateUrl: './support-hint.component.html',
  styleUrls: ['./support-hint.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SupportHintComponent {
  public readonly supportEmail: string = AppSettings.supportEmail;
}
