import { Injectable, NgZone, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class KeyboardShortcutsService {
  private readonly router = inject(Router);
  private readonly zone = inject(NgZone);

  /** Visibilità dell'overlay guida scorciatoie */
  readonly helpVisible = signal(false);

  private listening = false;
  private awaitingG = false;
  private gTimer: ReturnType<typeof setTimeout> | null = null;

  /** Avvia l'ascolto globale. Idempotente: chiamare una volta dallo shell. */
  start(): void {
    if (this.listening) return;
    this.listening = true;
    this.zone.runOutsideAngular(() => {
      document.addEventListener('keydown', this.handler);
    });
  }

  toggleHelp(): void {
    this.helpVisible.update((v) => !v);
  }

  closeHelp(): void {
    this.helpVisible.set(false);
  }

  private readonly handler = (e: KeyboardEvent): void => {
    // Ignora se l'utente sta scrivendo o se ci sono modificatori (lasciamo ⌘K alla palette)
    if (this.isTypingTarget(e.target) || e.metaKey || e.ctrlKey || e.altKey) {
      return;
    }

    if (e.key === 'Escape') {
      if (this.helpVisible()) {
        this.zone.run(() => this.closeHelp());
      }
      return;
    }

    if (e.key === '?') {
      e.preventDefault();
      this.zone.run(() => this.toggleHelp());
      return;
    }

    if (this.awaitingG) {
      this.awaitingG = false;
      if (this.gTimer) clearTimeout(this.gTimer);
      const dest = this.gDestination(e.key.toLowerCase());
      if (dest) {
        e.preventDefault();
        this.zone.run(() => void this.router.navigateByUrl(dest));
      }
      return;
    }

    if (e.key.toLowerCase() === 'g') {
      this.awaitingG = true;
      this.gTimer = setTimeout(() => (this.awaitingG = false), 1200);
      return;
    }

    if (e.key.toLowerCase() === 'c') {
      e.preventDefault();
      this.zone.run(() => void this.router.navigateByUrl('/admin/quests/new'));
    }
  };

  private gDestination(key: string): string | null {
    switch (key) {
      case 'd':
        return '/admin';
      case 'q':
        return '/admin/quests';
      case 'm':
        return '/admin/quests-map';
      case 's':
        return '/admin/settings';
      default:
        return null;
    }
  }

  private isTypingTarget(target: EventTarget | null): boolean {
    const el = target as HTMLElement | null;
    if (!el) return false;
    const tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
  }
}
