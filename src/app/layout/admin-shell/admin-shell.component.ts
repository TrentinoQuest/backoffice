import { Component, OnInit, computed, inject, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { BreadcrumbService } from '../../core/services/breadcrumb.service';
import { KeyboardShortcutsService } from '../../core/services/keyboard-shortcuts.service';
import { CommandPaletteComponent } from '../../shared/components/command-palette/command-palette.component';
import { ShortcutsHelpComponent } from '../../shared/components/shortcuts-help/shortcuts-help.component';

interface NavItem {
  label: string;
  route: string;
  exactMatch: boolean;
  /** d attribute per SVG path/polyline (viewBox 0 0 24 24, stroke-based, Feather icons) */
  svgPath: string;
  svgExtra?: string; // secondo path/line SVG opzionale
}

@Component({
  selector: 'app-admin-shell',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    CommandPaletteComponent,
    ShortcutsHelpComponent,
  ],
  templateUrl: './admin-shell.component.html',
  styleUrl: './admin-shell.component.scss',
})
export class AdminShellComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly breadcrumb = inject(BreadcrumbService);
  private readonly keyboardShortcuts = inject(KeyboardShortcutsService);

  ngOnInit(): void {
    this.keyboardShortcuts.start();
  }

  /** Riferimento alla command palette per apertura programmatica (⌘K / click sulla search). */
  @ViewChild(CommandPaletteComponent) palette?: CommandPaletteComponent;

  openPalette(): void {
    this.palette?.open();
  }

  readonly user = this.auth.currentUser;

  readonly sidebarCollapsed = signal(localStorage.getItem('tq-sidebar-collapsed') === 'true');

  readonly showToolbar = computed(() => !this.breadcrumb.config().hideShellToolbar);

  readonly navItems: NavItem[] = [
    {
      label: 'Dashboard',
      route: '/admin',
      exactMatch: true,
      svgPath: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
    },
    {
      label: 'Quest',
      route: '/admin/quests',
      exactMatch: false,
      svgPath: 'M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z',
      svgExtra: 'M4 22V15',
    },
    {
      label: 'Collezionabili',
      route: '/admin/collectibles',
      exactMatch: false,
      svgPath:
        'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
    },
    {
      label: 'Affiliazioni',
      route: '/admin/businesses',
      exactMatch: false,
      svgPath: 'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z',
      svgExtra: 'M9 22V12h6v10',
    },
    {
      label: 'Analytics',
      route: '/admin/analytics',
      exactMatch: false,
      svgPath: 'M18 20V10M12 20V4M6 20v-6',
    },
    {
      label: 'Impostazioni',
      route: '/admin/settings',
      exactMatch: false,
      svgPath:
        'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z',
    },
  ];

  // Nessun auto-collapse: lo stato della sidebar resta sotto controllo
  // esplicito dell'utente (toggle + persistenza in localStorage).

  toggleSidebar(): void {
    this.sidebarCollapsed.update((v) => !v);
    localStorage.setItem('tq-sidebar-collapsed', String(this.sidebarCollapsed()));
  }

  async logout(): Promise<void> {
    await this.auth.logout();
    await this.router.navigateByUrl('/login');
  }
}
