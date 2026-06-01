import { Injectable, signal } from '@angular/core';

export type Density = 'compact' | 'normal' | 'comfortable';

const KEYS = {
  density: 'tq-density',
  sidebarCollapsedStart: 'tq-pref-sidebar-collapsed-start',
  collapseOnMap: 'tq-pref-collapse-on-map',
  confirmBeforeArchive: 'tq-pref-confirm-archive',
} as const;

@Injectable({ providedIn: 'root' })
export class PreferencesService {
  readonly density = signal<Density>(this.readDensity());
  readonly sidebarCollapsedStart = signal<boolean>(this.readBool(KEYS.sidebarCollapsedStart, false));
  readonly collapseOnMap = signal<boolean>(this.readBool(KEYS.collapseOnMap, true));
  /** Default true: confermare prima di archiviare è la scelta sicura */
  readonly confirmBeforeArchive = signal<boolean>(this.readBool(KEYS.confirmBeforeArchive, true));

  constructor() {
    this.applyDensity();
  }

  setDensity(value: Density): void {
    this.density.set(value);
    localStorage.setItem(KEYS.density, value);
    this.applyDensity();
  }

  setSidebarCollapsedStart(value: boolean): void {
    this.sidebarCollapsedStart.set(value);
    localStorage.setItem(KEYS.sidebarCollapsedStart, String(value));
  }

  setCollapseOnMap(value: boolean): void {
    this.collapseOnMap.set(value);
    localStorage.setItem(KEYS.collapseOnMap, String(value));
  }

  setConfirmBeforeArchive(value: boolean): void {
    this.confirmBeforeArchive.set(value);
    localStorage.setItem(KEYS.confirmBeforeArchive, String(value));
  }

  private applyDensity(): void {
    document.documentElement.dataset['density'] = this.density();
  }

  private readDensity(): Density {
    const v = localStorage.getItem(KEYS.density);
    return v === 'compact' || v === 'comfortable' ? v : 'normal';
  }

  private readBool(key: string, fallback: boolean): boolean {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v === 'true';
  }
}
