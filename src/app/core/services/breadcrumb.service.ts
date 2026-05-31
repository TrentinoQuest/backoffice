import { Injectable, signal } from '@angular/core';

export interface BreadcrumbConfig {
  /** Testo visualizzato dopo "Admin ›" nella toolbar */
  label: string;
  /** Se true, la toolbar principale dello shell viene nascosta (es. form, mappa) */
  hideShellToolbar: boolean;
}

@Injectable({ providedIn: 'root' })
export class BreadcrumbService {
  readonly config = signal<BreadcrumbConfig>({ label: '', hideShellToolbar: false });

  set(label: string, hideShellToolbar = false): void {
    this.config.set({ label, hideShellToolbar });
  }
}
