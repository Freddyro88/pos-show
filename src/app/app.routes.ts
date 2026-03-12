import { Routes } from '@angular/router';
import { PosComponent } from './sales/pos.component';
import { AdminProductsComponent } from './products/admin-products.component';
import { AdminDashboardComponent } from './dashboard/admin-dashboard.component';
import { AdminShowsComponent } from './shows/admin-shows.component';
import { AdminUsersComponent } from './users/admin-users.component';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'pos' },
  { path: 'pos', component: PosComponent },
  { path: 'admin', component: AdminProductsComponent },
  { path: 'dashboard', component: AdminDashboardComponent },
  { path: 'shows', component: AdminShowsComponent },
  { path: 'users', component: AdminUsersComponent },
];
