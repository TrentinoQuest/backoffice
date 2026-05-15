import { Routes } from '@angular/router';
import { UserRole } from '@trentino-quest/shared-types';
import { authGuard, guestGuard, roleGuard } from './core/guards/auth.guard';

/**
 * Routing principale dell'applicazione.
 *
 * Tutte le pagine sono caricate in lazy via loadComponent per ridurre
 * il bundle iniziale. Le rotte sotto /admin sono protette da authGuard
 * e roleGuard(ADMIN), la rotta /login da guestGuard.
 *
 * Il routing di /admin usa il pattern shell + child routes: il
 * componente AdminShellComponent fornisce sidebar e toolbar, mentre
 * le pagine specifiche vengono caricate nel suo router-outlet.
 */
export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/common/auth/login/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'admin',
    canActivate: [authGuard, roleGuard([UserRole.ADMIN])],
    loadComponent: () =>
      import('./layout/admin-shell/admin-shell.component').then((m) => m.AdminShellComponent),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/admin/dashboard/dashboard.page').then((m) => m.AdminDashboardPage),
      },
      // Future child routes:
      // { path: 'quests', loadComponent: ... },
      // { path: 'collectibles', loadComponent: ... },
    ],
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
