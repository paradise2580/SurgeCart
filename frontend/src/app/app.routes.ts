import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'sales' },
  { path: 'login', loadComponent: () => import('./features/auth/login.component').then(m => m.LoginComponent) },
  { path: 'register', loadComponent: () => import('./features/auth/register.component').then(m => m.RegisterComponent) },
  { path: 'sales', loadComponent: () => import('./features/sale/sale-list.component').then(m => m.SaleListComponent) },
  { path: 'sales/:id', loadComponent: () => import('./features/sale/sale-detail.component').then(m => m.SaleDetailComponent), canActivate: [authGuard] },
  { path: 'orders', loadComponent: () => import('./features/orders/order-history.component').then(m => m.OrderHistoryComponent), canActivate: [authGuard] },
  { path: 'admin', loadComponent: () => import('./features/admin/admin-dashboard.component').then(m => m.AdminDashboardComponent), canActivate: [authGuard, adminGuard] },
  { path: '**', redirectTo: 'sales' },
];
