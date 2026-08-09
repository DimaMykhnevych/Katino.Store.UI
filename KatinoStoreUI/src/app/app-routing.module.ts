import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { NavbarComponent } from './layout/navbar/navbar.component';
import { MainPageComponent } from './features/main-page/main-page.component';
import { CatalogComponent } from './features/catalog/catalog.component';
import { ProductDetailsComponent } from './features/product-details/product-details.component';

const routes: Routes = [
  {
    path: '',
    component: NavbarComponent,
    children: [
      {
        path: '',
        redirectTo: 'main',
        pathMatch: 'full',
      },
      {
        path: 'main',
        component: MainPageComponent,
      },
      {
        path: 'catalog',
        component: CatalogComponent,
      },
      {
        path: 'product/:id',
        component: ProductDetailsComponent,
      },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
