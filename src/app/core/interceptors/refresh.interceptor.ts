import {
  HttpInterceptorFn,
  HttpRequest,
  HttpHandlerFn,
  HttpEvent,
  HttpErrorResponse,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  BehaviorSubject,
  Observable,
  catchError,
  filter,
  from,
  switchMap,
  take,
  throwError,
} from 'rxjs';
import type { RefreshTokenResponse } from '@trentino-quest/shared-types';
import { AuthService } from '../services/auth.service';
import { environment } from '../../../environments/environment';

/**
 * Stato condiviso fra invocazioni multiple dell'interceptor.
 *
 * Quando una richiesta riceve 401, l'interceptor avvia un refresh del
 * token e setta isRefreshing=true. Le richieste successive che si
 * trovano anch'esse in 401 non avviano un nuovo refresh: si mettono in
 * attesa su refreshSubject, e riprovano la richiesta originale appena
 * il refresh in corso emette il nuovo token.
 *
 * Questo evita il bug della "doppia rotation": se due 401 paralleli
 * chiamassero entrambi /auth/refresh con lo stesso refresh token, il
 * secondo fallirebbe perche' il token e' stato gia' invalidato dal
 * primo, e l'utente verrebbe sbattuto fuori dall'app.
 *
 * Le variabili sono a livello di modulo perche' l'interceptor e'
 * stateless per design (HttpInterceptorFn): non puo' avere stato
 * d'istanza. Per stato condiviso si usa lo scope di modulo,
 * approccio standard nella community Angular.
 */
let isRefreshing = false;
const refreshSubject = new BehaviorSubject<string | null>(null);

/**
 * HTTP interceptor che intercetta i 401 e tenta di rinnovare l'access
 * token tramite il refresh token salvato.
 *
 * Logica:
 * - Lascia passare richieste non-API o richieste verso /auth/* senza
 *   tentare refresh (queste sono di per se' le endpoint di auth).
 * - Se la risposta e' 401 e c'e' un refresh token, attiva il refresh.
 * - Se un altro refresh e' gia' in corso (isRefreshing=true), aspetta
 *   il completamento e riprova con il nuovo token.
 * - Se il refresh fallisce, fa logout e redirige a /login.
 *
 * Registrazione: nel withInterceptors([authInterceptor, refreshInterceptor]).
 * IMPORTANTE: deve essere registrato DOPO authInterceptor.
 */
export const refreshInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return next(req).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401) {
        return throwError(() => error);
      }

      const isApiRequest = req.url.startsWith(environment.apiBaseUrl);
      const isAuthEndpoint = req.url.includes('/auth/');
      if (!isApiRequest || isAuthEndpoint) {
        return throwError(() => error);
      }

      const refreshToken = auth.getRefreshToken();
      if (!refreshToken) {
        return throwError(() => error);
      }

      return handle401(req, next, auth, router);
    }),
  );
};

/**
 * Gestisce la logica del 401: avvia un refresh o aspetta quello in
 * corso, poi riprova la richiesta originale.
 */
function handle401(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
  auth: AuthService,
  router: Router,
): Observable<HttpEvent<unknown>> {
  if (isRefreshing) {
    return refreshSubject.pipe(
      filter((token): token is string => token !== null),
      take(1),
      switchMap((token) => next(cloneWithToken(req, token))),
    );
  }

  isRefreshing = true;
  refreshSubject.next(null);

  return from(performRefresh(auth)).pipe(
    switchMap((newAccessToken) => {
      isRefreshing = false;
      refreshSubject.next(newAccessToken);
      return next(cloneWithToken(req, newAccessToken));
    }),
    catchError((refreshError: unknown) => {
      isRefreshing = false;
      refreshSubject.next(null);
      auth.clearSession();
      router.navigateByUrl('/login');
      return throwError(() => refreshError);
    }),
  );
}

/**
 * Esegue la chiamata effettiva a POST /auth/refresh e ritorna il nuovo
 * access token. Aggiorna anche lo stato in AuthService con i nuovi
 * tokens (rotation lato server).
 *
 * Usa fetch nativo invece dell'HttpClient di Angular per evitare che
 * la chiamata passi attraverso questo stesso interceptor in modo
 * ricorsivo (un 401 sulla refresh stessa scatenerebbe un loop).
 */
async function performRefresh(auth: AuthService): Promise<string> {
  const refreshToken = auth.getRefreshToken();
  if (!refreshToken) {
    throw new Error('Nessun refresh token disponibile');
  }

  const response = await fetch(`${environment.apiBaseUrl}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) {
    throw new Error(`Refresh fallito con status ${response.status}`);
  }

  const data = (await response.json()) as RefreshTokenResponse;

  auth.saveSession({
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    accessExpiresIn: data.accessExpiresIn,
    refreshExpiresIn: data.refreshExpiresIn,
    user: auth.currentUser()!,
  });

  return data.accessToken;
}

/**
 * Clona una richiesta sostituendo l'header Authorization con il nuovo
 * token. Usato sia per la richiesta che ha originato il 401 che per
 * quelle che attendevano il refresh.
 */
function cloneWithToken(req: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
  return req.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`,
    },
  });
}
