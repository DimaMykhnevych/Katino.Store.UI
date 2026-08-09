import {
  Component,
  Input,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { ProductCardPhoto } from 'src/app/core/models/product-photo/product-card-photo';

@Component({
  selector: 'app-product-gallery',
  templateUrl: './product-gallery.component.html',
  styleUrls: ['./product-gallery.component.scss'],
})
export class ProductGalleryComponent implements OnChanges {
  @Input() photos: ProductCardPhoto[] = [];

  public readonly placeholderUrl = 'https://placehold.co/800x1066';
  public activeIndex = 0;
  public sortedPhotos: ProductCardPhoto[] = [];

  private readonly _loadedPhotoIds = new Set<string>();

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['photos']) {
      this.sortedPhotos = [...this.photos].sort(
        (a, b) => a.displayOrder - b.displayOrder,
      );
      this.activeIndex = 0;
    }
  }

  public get activePhoto(): ProductCardPhoto | null {
    return this.sortedPhotos[this.activeIndex] ?? null;
  }

  public selectPhoto(index: number): void {
    this.activeIndex = index;
  }

  public previous(): void {
    this.activeIndex =
      (this.activeIndex - 1 + this.sortedPhotos.length) %
      this.sortedPhotos.length;
  }

  public next(): void {
    this.activeIndex = (this.activeIndex + 1) % this.sortedPhotos.length;
  }

  public isPhotoLoading(photo: ProductCardPhoto | null): boolean {
    return !!photo && !this._loadedPhotoIds.has(photo.id);
  }

  public onImageLoad(photo: ProductCardPhoto | null): void {
    if (photo) {
      this._loadedPhotoIds.add(photo.id);
    }
  }

  public onImageError(event: Event, photo: ProductCardPhoto | null): void {
    if (photo) {
      this._loadedPhotoIds.add(photo.id);
    }
    (event.target as HTMLImageElement).src = this.placeholderUrl;
  }
}
