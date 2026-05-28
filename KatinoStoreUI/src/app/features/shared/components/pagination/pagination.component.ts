import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-pagination',
  templateUrl: './pagination.component.html',
  styleUrls: ['./pagination.component.scss'],
})
export class PaginationComponent {
  @Input() totalPages: number = 0;
  @Input() pageIndex: number = 0;
  @Output() pageChange = new EventEmitter<number>();

  public get visiblePages(): (number | '...')[] {
    const total = this.totalPages;
    const current = this.pageIndex + 1;

    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }

    const pages: (number | '...')[] = [1];

    if (current > 3) pages.push('...');

    const from = Math.max(2, current - 1);
    const to = Math.min(total - 1, current + 1);
    for (let i = from; i <= to; i++) pages.push(i);

    if (current < total - 2) pages.push('...');

    pages.push(total);
    return pages;
  }

  public isEllipsis(page: number | string): boolean {
    return page === '...';
  }

  public goToPage(index: number): void {
    if (index < 0 || index >= this.totalPages) return;
    this.pageChange.emit(index);
  }
}
