import { Injectable, signal, computed } from '@angular/core';

export type ThemeMode = 'light' | 'dark' | 'system';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly STORAGE_KEY = 'tq-theme';
  private readonly REDUCE_MOTION_KEY = 'tq-reduce-motion';

  readonly mode = signal<ThemeMode>(this.readStoredMode());
  readonly reduceMotion = signal<boolean>(this.readReduceMotion());

  readonly isDark = computed(() => {
    if (this.mode() === 'dark') return true;
    if (this.mode() === 'light') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  constructor() {
    this.applyTheme();
  }

  setMode(mode: ThemeMode): void {
    this.mode.set(mode);
    localStorage.setItem(this.STORAGE_KEY, mode);
    this.applyTheme();
  }

  setReduceMotion(value: boolean): void {
    this.reduceMotion.set(value);
    localStorage.setItem(this.REDUCE_MOTION_KEY, String(value));
    document.documentElement.classList.toggle('reduce-motion', value);
  }

  private applyTheme(): void {
    document.documentElement.classList.toggle('dark', this.isDark());
  }

  private readStoredMode(): ThemeMode {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
    return 'system';
  }

  private readReduceMotion(): boolean {
    return localStorage.getItem(this.REDUCE_MOTION_KEY) === 'true';
  }
}
