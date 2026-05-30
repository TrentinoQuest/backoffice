import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { AuthService } from '../../core/services/auth.service';

/**
 * Voce di navigazione nella sidebar del backoffice.
 */
interface NavItem {
  label: string;
  icon: string;
  route: string;
}

/**
 * Shell layout del pannello amministrativo.
 *
 * Fornisce la struttura comune di tutte le pagine sotto /admin:
 * - Toolbar superiore con titolo del prodotto e menu utente
 * - Sidebar laterale con i link alle sezioni principali
 * - Area centrale con router-outlet per le pagine specifiche
 *
 * Le pagine sono registrate come child route di /admin in app.routes.ts.
 */
@Component({
  selector: 'app-admin-shell',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatSidenavModule,
    MatToolbarModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    MatMenuModule,
  ],
  templateUrl: './admin-shell.component.html',
  styleUrl: './admin-shell.component.scss',
})
export class AdminShellComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /**
   * Utente correntemente loggato, esposto come signal per il binding
   * con il template (mostra l'email nel menu utente).
   */
  readonly user = this.auth.currentUser;

  /**
   * Voci di navigazione mostrate nella sidebar.
   *
   * Definite come array statico: l'ordine e' significativo (riflette
   * l'importanza relativa delle sezioni). Le icone seguono il set
   * Material Symbols, gia' caricato globalmente da Angular Material.
   */
  readonly navItems: NavItem[] = [
    { label: 'Dashboard', icon: 'dashboard', route: '/admin' },
    { label: 'Quest', icon: 'flag', route: '/admin/quests' },
    { label: 'Mappa quest', icon: 'map', route: '/admin/quests-map' },
    { label: 'Collezionabili', icon: 'collections_bookmark', route: '/admin/collectibles' },
    { label: 'Affiliazioni', icon: 'store', route: '/admin/businesses' },
  ];

  /**
   * Esegue il logout e redirige alla pagina di login.
   */
  async logout(): Promise<void> {
    await this.auth.logout();
    await this.router.navigateByUrl('/login');
  }
}
