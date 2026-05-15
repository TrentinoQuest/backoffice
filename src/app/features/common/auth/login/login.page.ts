import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { UserRole } from '@trentino-quest/shared-types';
import { AuthService } from '../../../../core/services/auth.service';

/**
 * Pagina di login del backoffice.
 *
 * Mostra un form con email/password e gestisce l'autenticazione tramite
 * AuthService. In caso di successo, redirige alla dashboard. Visualizza
 * messaggi di errore distinti per credenziali errate, ruolo non admin,
 * e problemi di rete.
 */
@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './login.page.html',
  styleUrl: './login.page.scss',
})
export class LoginPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /**
   * Form reactive con validazione email + password obbligatori.
   */
  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  /**
   * Signal per disabilitare il pulsante durante il login in corso.
   */
  readonly isSubmitting = signal(false);

  /**
   * Signal per mostrare un messaggio di errore in caso di fallimento.
   * Null quando non ci sono errori.
   */
  readonly errorMessage = signal<string | null>(null);

  /**
   * Signal per togglare la visibilita' della password.
   */
  readonly passwordVisible = signal(false);

  /**
   * Esegue il login chiamando AuthService e gestendo gli errori.
   *
   * Vincolo di sicurezza: il backoffice ammette solo utenti con ruolo
   * ADMIN. Se il login va a buon fine ma il ruolo e' diverso, viene
   * subito eseguito il logout e mostrato un messaggio dedicato.
   */
  async onSubmit(): Promise<void> {
    if (this.form.invalid || this.isSubmitting()) {
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    try {
      const { email, password } = this.form.getRawValue();
      await this.auth.login(email, password);

      if (this.auth.currentRole() !== UserRole.ADMIN) {
        await this.auth.logout();
        this.errorMessage.set(
          'Accesso riservato agli amministratori. Le credenziali fornite non hanno i permessi necessari.',
        );
        return;
      }

      await this.router.navigateByUrl('/admin');
    } catch (err) {
      this.errorMessage.set(this.toUserMessage(err));
    } finally {
      this.isSubmitting.set(false);
    }
  }

  /**
   * Toggle visibilita' della password nel form.
   */
  togglePasswordVisibility(): void {
    this.passwordVisible.update((v) => !v);
  }

  /**
   * Traduce un errore HTTP in un messaggio leggibile per l'utente,
   * differenziando per status code.
   */
  private toUserMessage(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      if (err.status === 401) {
        return 'Credenziali non valide';
      }
      if (err.status === 0) {
        return 'Impossibile contattare il server. Verifica la connessione.';
      }
    }
    return "Errore inatteso durante il login. Riprova piu' tardi.";
  }
}
