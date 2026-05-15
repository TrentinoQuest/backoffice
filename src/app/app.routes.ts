import { Routes } from '@angular/router';

/**
 * Routing principale dell'applicazione.
 *
 * Tutte le pagine sono caricate in lazy via loadComponent per ridurre
 * il bundle iniziale. La protezione delle route admin via guard verra'
 * aggiunta nel Mini-step D.
 */
export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/common/auth/login/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'admin',
    loadComponent: () =>
      import('./features/admin/dashboard/dashboard.page').then((m) => m.AdminDashboardPage),
  },
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'login',
  },
  {
    path: '**',
    redirectTo: 'login',
  },
];
