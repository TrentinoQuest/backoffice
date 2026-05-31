import { Routes } from '@angular/router';
import { UserRole } from '@trentino-quest/shared-types';
import { authGuard, guestGuard, roleGuard } from './core/guards/auth.guard';

/**
 * Routing principale dell'applicazione.
 *
 * Tutte le pagine sono caricate in lazy via loadComponent per ridurre
 * il bundle iniziale. Le rotte sotto /admin sono protette da authGuard
 * e roleGuard(ADMIN), la rotta /login da guestGuard.
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
      {
        path: 'quests',
        loadComponent: () =>
          import('./features/admin/quests/admin-quests.page').then((m) => m.AdminQuestsPage),
      },
      {
        path: 'quests/new',
        loadComponent: () =>
          import('./features/admin/quests/admin-quest-form.page').then((m) => m.AdminQuestFormPage),
      },
      {
        path: 'quests/:id/edit',
        loadComponent: () =>
          import('./features/admin/quests/admin-quest-form.page').then((m) => m.AdminQuestFormPage),
      },
      {
        path: 'quests-map',
        loadComponent: () =>
          import('./features/admin/quests/admin-quests-map.page').then((m) => m.AdminQuestsMapPage),
      },
      {
        path: 'collectibles',
        loadComponent: () =>
          import('./features/admin/collectibles/admin-collectibles.page').then(
            (m) => m.AdminCollectiblesPage,
          ),
      },
      {
        path: 'collectibles/new',
        loadComponent: () =>
          import('./features/admin/collectibles/admin-collectible-form.page').then(
            (m) => m.AdminCollectibleFormPage,
          ),
      },
      {
        path: 'collectibles/:id/edit',
        loadComponent: () =>
          import('./features/admin/collectibles/admin-collectible-form.page').then(
            (m) => m.AdminCollectibleFormPage,
          ),
      },
      {
        path: 'businesses',
        loadComponent: () =>
          import('./features/admin/businesses/admin-businesses.page').then(
            (m) => m.AdminBusinessesPage,
          ),
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/admin/settings/settings.page').then((m) => m.SettingsPage),
      },
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
