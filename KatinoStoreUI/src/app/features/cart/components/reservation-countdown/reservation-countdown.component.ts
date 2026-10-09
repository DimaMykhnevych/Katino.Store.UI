import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { BehaviorSubject, combineLatest, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ClockService } from 'src/app/core/services/clock.service';

@Component({
  selector: 'app-reservation-countdown',
  templateUrl: './reservation-countdown.component.html',
  styleUrls: ['./reservation-countdown.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReservationCountdownComponent {
  private readonly _expiresAt$ = new BehaviorSubject<number>(0);

  // Remaining time as "m:ss", or null once the hold has expired.
  public readonly remaining$: Observable<string | null>;

  constructor(clock: ClockService) {
    this.remaining$ = combineLatest([this._expiresAt$, clock.now$]).pipe(
      map(([expiresAt, now]) => this._format(expiresAt - now)),
    );
  }

  @Input()
  public set expiresAt(value: string) {
    this._expiresAt$.next(new Date(value).getTime());
  }

  private _format(ms: number): string | null {
    if (ms <= 0) {
      return null;
    }

    const totalSeconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
}
