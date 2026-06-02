import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ThemeService, ThemeMode } from '../../../core/services/theme.service';
import { PreferencesService, Density } from '../../../core/services/preferences.service';
import { BreadcrumbService } from '../../../core/services/breadcrumb.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToggleSwitchComponent } from '../../../shared/components/toggle-switch/toggle-switch.component';

interface NavSection {
  id: string;
  label: string;
}

interface Shortcut {
  keys: string[];
  label: string;
}

interface ShortcutCategory {
  title: string;
  items: Shortcut[];
}

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, ToggleSwitchComponent],
  templateUrl: './settings.page.html',
  styleUrl: './settings.page.scss',
})
export class SettingsPage implements OnInit {
  readonly theme = inject(ThemeService);
  readonly prefs = inject(PreferencesService);
  private readonly breadcrumb = inject(BreadcrumbService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly user = this.auth.currentUser;
  readonly activeSection = signal<string>('appearance');

  readonly sections: NavSection[] = [
    { id: 'appearance', label: 'Aspetto' },
    { id: 'customization', label: 'Personalizzazione' },
    { id: 'preferences', label: 'Preferenze' },
    { id: 'shortcuts', label: 'Scorciatoie' },
    { id: 'account', label: 'Account' },
  ];

  readonly themeModes: { value: ThemeMode; label: string }[] = [
    { value: 'light', label: 'Chiaro' },
    { value: 'dark', label: 'Scuro' },
    { value: 'system', label: 'Sistema' },
  ];

  readonly densities: { value: Density; label: string }[] = [
    { value: 'compact', label: 'Compatta' },
    { value: 'normal', label: 'Normale' },
    { value: 'comfortable', label: 'Spaziosa' },
  ];

  readonly shortcutCategories: ShortcutCategory[] = [
    {
      title: 'Navigazione',
      items: [
        { keys: ['G', 'D'], label: 'Vai a Dashboard' },
        { keys: ['G', 'Q'], label: 'Vai a Quest' },
        { keys: ['G', 'M'], label: 'Vai a Mappa quest' },
        { keys: ['G', 'S'], label: 'Vai a Impostazioni' },
      ],
    },
    {
      title: 'Azioni',
      items: [
        { keys: ['C'], label: 'Nuova quest' },
        { keys: ['⌘', 'K'], label: 'Apri command palette' },
        { keys: ['?'], label: 'Mostra questa guida' },
        { keys: ['Esc'], label: 'Chiudi overlay' },
      ],
    },
  ];

  ngOnInit(): void {
    this.breadcrumb.set('Impostazioni');
  }

  selectSection(id: string): void {
    this.activeSection.set(id);
  }

  setTheme(mode: ThemeMode): void {
    this.theme.setMode(mode);
  }

  setDensity(d: Density): void {
    this.prefs.setDensity(d);
  }

  async logout(): Promise<void> {
    await this.auth.logout();
    void this.router.navigateByUrl('/login');
  }
}
