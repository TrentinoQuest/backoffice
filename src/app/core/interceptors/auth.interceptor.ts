import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { environment } from '../../../environments/environment';

/**
 * HTTP interceptor che allega l'access token alle richieste indirizzate
 * all'API del backend.
 *
 * Logica:
 * - Solo le richieste verso l'API backend (environment.apiBaseUrl)
 *   ricevono il bearer token, per evitare di esporre il token a domini
 *   esterni (es. mappe, cdn) che potrebbero essere chiamati in futuro.
 * - Se l'utente non e' autenticato (nessun access token in storage),
 *   la richiesta passa senza modifiche: gli endpoint pubblici come
 *   /auth/login devono poter funzionare anche senza header.
 * - Vengono escluse le route di autenticazione stessa (/auth/login,
 *   /auth/refresh, /auth/register, /auth/password-recovery): chiamarle
 *   con un eventuale access token vecchio puo' confondere il backend
 *   o causare 401 non necessari durante il login.
 *
 * Registrazione: in app.config.ts via provideHttpClient(withInterceptors([authInterceptor])).
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);

  const isApiRequest = req.url.startsWith(environment.apiBaseUrl);
  if (!isApiRequest) {
    return next(req);
  }

  const isAuthRoute =
    req.url.includes('/auth/login') ||
    req.url.includes('/auth/refresh') ||
    req.url.includes('/auth/register') ||
    req.url.includes('/auth/password-recovery');
  if (isAuthRoute) {
    return next(req);
  }

  const token = auth.getAccessToken();
  if (!token) {
    return next(req);
  }

  const cloned = req.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`,
    },
  });
  return next(cloned);
};
