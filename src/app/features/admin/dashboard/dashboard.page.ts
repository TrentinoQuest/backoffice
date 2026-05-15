import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { AuthService } from '../../../core/services/auth.service';

/**
 * Dashboard placeholder del pannello admin.
 *
 * Pagina temporanea mostrata dopo il login per verificare che il flusso
 * di autenticazione funzioni end-to-end. Sara' sostituita dallo shell
 * completo (sidebar + routing alle feature) nel Mini-step E.
 */
@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [MatCardModule, MatButtonModule],
  template: `
    <div class="dashboard-container">
      <mat-card appearance="outlined">
        <mat-card-header>
          <mat-card-title>Benvenuto nel pannello admin</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <p>Login completato correttamente.</p>
          <p>
            Utente: <strong>{{ user()?.email }}</strong>
          </p>
          <p>
            Ruolo: <strong>{{ user()?.role }}</strong>
          </p>
        </mat-card-content>
        <mat-card-actions>
          <button mat-stroked-button (click)="logout()">Logout</button>
        </mat-card-actions>
      </mat-card>
    </div>
  `,
  styles: [
    `
      .dashboard-container {
        max-width: 600px;
        margin: 2rem auto;
        padding: 1rem;
      }
      mat-card-content {
        margin: 1rem 0;
      }
    `,
  ],
})
export class AdminDashboardPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly user = this.auth.currentUser;

  async logout(): Promise<void> {
    await this.auth.logout();
    await this.router.navigateByUrl('/login');
  }
}
