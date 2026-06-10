import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { UserRole } from '@trentino-quest/shared-types';
import { AuthService } from '../services/auth.service';

/**
 * Guard che richiede l'utente autenticato.
 *
 * Se l'utente e' loggato, permette il passaggio. Altrimenti redirige
 * a /login. Va usato in combinazione con roleGuard per le route che
 * richiedono anche un ruolo specifico.
 */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated()) {
    return true;
  }

  router.navigateByUrl('/login');
  return false;
};

/**
 * Factory di guard per la verifica del ruolo.
 *
 * Ritorna un guard che ammette solo utenti con uno dei ruoli specificati.
 * Va registrato DOPO authGuard nella catena canActivate, perche' presume
 * che l'utente sia gia' autenticato.
 *
 * Esempio d'uso nelle route:
 *   canActivate: [authGuard, roleGuard([UserRole.ADMIN])]
 *
 * Se il ruolo non corrisponde, redirige a /login dopo aver fatto logout
 * locale: meglio che l'utente entri di nuovo con le credenziali corrette
 * piuttosto che mostrargli una pagina "forbidden".
 */
export function roleGuard(allowedRoles: UserRole[]): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    const role = auth.currentRole();
    if (role && allowedRoles.includes(role)) {
      return true;
    }

    auth.clearSession();
    router.navigateByUrl('/login');
    return false;
  };
}

/**
 * Guard che richiede l'utente NON autenticato.
 *
 * Usato sulla pagina di login: se l'utente e' gia' autenticato come
 * admin, viene redirezionato direttamente al pannello. Evita la
 * situazione "utente loggato che vede la pagina di login".
 */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isAuthenticated()) {
    return true;
  }

  if (auth.currentRole() === UserRole.ADMIN) {
    router.navigateByUrl('/admin');
  } else if (auth.currentRole() === UserRole.MAINTENANCE) {
    router.navigateByUrl('/operator');
  } else {
    auth.clearSession();
  }
  return false;
};
