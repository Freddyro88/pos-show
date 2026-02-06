import { Routes } from '@angular/router';
import { PosComponent } from './sales/pos.component';
import { AdminProductsComponent } from './products/admin-products.component';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'pos' },
  { path: 'pos', component: PosComponent },
  { path: 'admin', component: AdminProductsComponent },
];