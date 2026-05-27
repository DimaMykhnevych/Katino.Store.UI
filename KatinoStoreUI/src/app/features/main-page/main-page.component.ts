import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-main-page',
  templateUrl: './main-page.component.html',
  styleUrls: ['./main-page.component.scss'],
})
export class MainPageComponent implements OnInit, OnDestroy {
  public search: string = '';

  private _querySub!: Subscription;

  constructor(private _route: ActivatedRoute) {}

  public ngOnInit(): void {
    this._querySub = this._route.queryParams.subscribe((params) => {
      this.search = params['search'] || '';
    });
  }

  public ngOnDestroy(): void {
    this._querySub?.unsubscribe();
  }
}
