import { Injectable } from '@angular/core';
import { Observable, timer } from 'rxjs';
import { map, shareReplay } from 'rxjs/operators';

// One shared ticking clock for all countdowns on the page.
@Injectable({
  providedIn: 'root',
})
export class ClockService {
  public readonly now$: Observable<number> = timer(0, 1000).pipe(
    map(() => Date.now()),
    shareReplay({ bufferSize: 1, refCount: true }),
  );
}
