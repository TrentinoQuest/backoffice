import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type {
  AuthResponse,
  LoginRequest,
  AuthenticatedUser,
  UserRole,
} from '@trentino-quest/shared-types';
import { environment } from '../../../environments/environment';

/**
 * Chiavi usate in localStorage per persistere lo stato di sessione tra
 * ricariche della pagina. I valori sono opzionalmente cifrabili in
 * futuro se l'app dovesse evolversi verso requisiti di sicurezza piu'
 * stringenti, ma per il contesto attuale (pannello amministrativo su
 * dominio interno) localStorage e' sufficiente.
 */
const STORAGE_KEYS = {
  accessToken: 'tq_admin_access_token',
  refreshToken: 'tq_admin_refresh_token',
  user: 'tq_admin_user',
} as const;

/**
 * Service di autenticazione per il backoffice.
 *
 * Espone lo stato di sessione come Angular signal: i componenti possono
 * iscriversi a currentUser() e isAuthenticated() per reagire ai cambi
 * di stato senza dover gestire RxJS.
 *
 * I token vengono persistiti in localStorage cosi' che la sessione
 * sopravviva alle ricariche della pagina. All'avvio del service, lo
 * stato viene rievocato dal localStorage se presente.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  /**
   * Signal con l'utente correntemente loggato, o null se non autenticato.
   */
  readonly currentUser = signal<AuthenticatedUser | null>(this.loadStoredUser());

  /**
   * Signal derivato che indica se l'utente e' autenticato.
   */
  readonly isAuthenticated = computed(() => this.currentUser() !== null);

  /**
   * Signal derivato con il ruolo dell'utente, o null se non autenticato.
   */
  readonly currentRole = computed<UserRole | null>(() => this.currentUser()?.role ?? null);

  /**
   * Effettua il login chiamando POST /auth/login del backend.
   * In caso di successo, salva tokens+user e aggiorna lo stato signal.
   */
  async login(email: string, password: string): Promise<void> {
    const request: LoginRequest = { email, password };
    const response = await firstValueFrom(
      this.http.post<AuthResponse>(`${environment.apiBaseUrl}/auth/login`, request),
    );
    this.saveSession(response);
  }

  /**
   * Effettua il logout chiamando POST /auth/logout del backend e
   * cancella lo stato locale. Anche in caso di errore di rete, lo
   * stato locale viene azzerato cosi' che l'utente non rimanga in
   * uno stato incoerente.
   */
  async logout(): Promise<void> {
    const refreshToken = this.getRefreshToken();
    if (refreshToken) {
      try {
        await firstValueFrom(
          this.http.post(`${environment.apiBaseUrl}/auth/logout`, { refreshToken }),
        );
      } catch {
        // Best-effort: anche se la chiamata fallisce, cancelliamo lo stato.
      }
    }
    this.clearSession();
  }

  /**
   * Ritorna l'access token corrente per essere usato negli header
   * Authorization. Null se non autenticato.
   */
  getAccessToken(): string | null {
    return localStorage.getItem(STORAGE_KEYS.accessToken);
  }

  /**
   * Ritorna il refresh token corrente. Null se non autenticato.
   */
  getRefreshToken(): string | null {
    return localStorage.getItem(STORAGE_KEYS.refreshToken);
  }

  /**
   * Salva i token e l'utente in localStorage e aggiorna lo stato signal.
   * Usato sia al login che dopo un refresh token con rotation.
   */
  saveSession(response: AuthResponse): void {
    localStorage.setItem(STORAGE_KEYS.accessToken, response.accessToken);
    localStorage.setItem(STORAGE_KEYS.refreshToken, response.refreshToken);
    localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(response.user));
    this.currentUser.set(response.user);
  }

  /**
   * Cancella la sessione locale. Usato dopo logout o dopo un 401
   * irrecuperabile dal refresh interceptor.
   */
  clearSession(): void {
    localStorage.removeItem(STORAGE_KEYS.accessToken);
    localStorage.removeItem(STORAGE_KEYS.refreshToken);
    localStorage.removeItem(STORAGE_KEYS.user);
    this.currentUser.set(null);
  }

  /**
   * Carica l'utente da localStorage all'inizializzazione del service.
   * Usato come valore iniziale del signal currentUser.
   *
   * Se il JSON e' malformato (improbabile, ma possibile se localStorage
   * viene manipolato manualmente), pulisce lo stato e ritorna null.
   */
  private loadStoredUser(): AuthenticatedUser | null {
    const raw = localStorage.getItem(STORAGE_KEYS.user);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as AuthenticatedUser;
    } catch {
      this.clearSession();
      return null;
    }
  }
}
