import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { NavbarComponent } from './layout/navbar/navbar.component';
import { MainPageComponent } from './features/main-page/main-page.component';

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
    ],
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
