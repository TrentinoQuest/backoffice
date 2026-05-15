import { Component, inject } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../../core/services/auth.service';

/**
 * Pagina di benvenuto del pannello admin.
 *
 * Caricata come child route di /admin (path vuoto) tramite lo shell.
 * Per ora mostra solo un saluto e alcune statistiche placeholder; verra'
 * arricchita con dati reali (numero di quest attive, completamenti
 * recenti, ecc.) quando il modulo analytics sara' disponibile.
 */
@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [MatCardModule, MatIconModule],
  template: `
    <div class="dashboard">
      <h1 class="page-title">Dashboard</h1>
      <p class="welcome">
        Benvenuto, <strong>{{ user()?.email }}</strong>
      </p>

      <div class="cards">
        <mat-card appearance="outlined">
          <mat-card-content>
            <div class="card-row">
              <mat-icon class="card-icon">flag</mat-icon>
              <div>
                <div class="card-value">—</div>
                <div class="card-label">Quest attive</div>
              </div>
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card appearance="outlined">
          <mat-card-content>
            <div class="card-row">
              <mat-icon class="card-icon">collections_bookmark</mat-icon>
              <div>
                <div class="card-value">—</div>
                <div class="card-label">Collezionabili</div>
              </div>
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card appearance="outlined">
          <mat-card-content>
            <div class="card-row">
              <mat-icon class="card-icon">people</mat-icon>
              <div>
                <div class="card-value">—</div>
                <div class="card-label">Giocatori registrati</div>
              </div>
            </div>
          </mat-card-content>
        </mat-card>
      </div>
    </div>
  `,
  styles: [
    `
      .dashboard {
        max-width: 1200px;
      }
      .page-title {
        font-size: 1.75rem;
        font-weight: 500;
        margin: 0 0 0.5rem;
      }
      .welcome {
        color: rgba(0, 0, 0, 0.6);
        margin-bottom: 2rem;
      }
      .cards {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 1rem;
      }
      .card-row {
        display: flex;
        align-items: center;
        gap: 1rem;
      }
      .card-icon {
        font-size: 2.5rem;
        height: 2.5rem;
        width: 2.5rem;
        color: #1976d2;
      }
      .card-value {
        font-size: 1.75rem;
        font-weight: 500;
        line-height: 1;
      }
      .card-label {
        color: rgba(0, 0, 0, 0.6);
        font-size: 0.875rem;
      }
    `,
  ],
})
export class AdminDashboardPage {
  private readonly auth = inject(AuthService);
  readonly user = this.auth.currentUser;
}
