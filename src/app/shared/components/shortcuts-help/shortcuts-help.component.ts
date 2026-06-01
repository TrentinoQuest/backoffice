import { Component, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { KeyboardShortcutsService } from '../../../core/services/keyboard-shortcuts.service';

interface HelpRow {
  keys: string[];
  label: string;
}

@Component({
  selector: 'app-shortcuts-help',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (shortcuts.helpVisible()) {
      <div class="overlay" (click)="shortcuts.closeHelp()">
        <div class="panel" (click)="$event.stopPropagation()" role="dialog" aria-label="Scorciatoie">
          <header class="panel__head">
            <h2>Scorciatoie da tastiera</h2>
            <button type="button" class="close" (click)="shortcuts.closeHelp()" aria-label="Chiudi">
              ✕
            </button>
          </header>
          <ul class="rows">
            @for (r of rows; track r.label) {
              <li>
                <span class="label">{{ r.label }}</span>
                <span class="keys">
                  @for (k of r.keys; track k) {
                    <kbd>{{ k }}</kbd>
                  }
                </span>
              </li>
            }
          </ul>
          <footer class="panel__foot"><kbd>?</kbd> apre/chiude · <kbd>Esc</kbd> chiude</footer>
        </div>
      </div>
    }
  `,
  styles: [
    `
      .overlay {
        position: fixed;
        inset: 0;
        background: rgba(7, 26, 14, 0.5);
        backdrop-filter: blur(6px);
        display: flex;
        align-items: flex-start;
        justify-content: center;
        padding-top: 12vh;
        z-index: 1000;
        animation: fade 160ms ease-out;
      }
      @keyframes fade {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }
      .panel {
        width: 460px;
        max-width: 92vw;
        background: var(--tq-surface);
        border: 1px solid var(--tq-border);
        border-radius: var(--tq-r-lg);
        box-shadow: var(--tq-shadow-lg);
        overflow: hidden;
      }
      .panel__head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 20px;
        border-bottom: 1px solid var(--tq-border);
      }
      .panel__head h2 {
        font-family: var(--tq-font-display);
        font-size: 16px;
        font-weight: 600;
        margin: 0;
        color: var(--tq-text);
      }
      .close {
        background: none;
        border: none;
        color: var(--tq-text-muted);
        cursor: pointer;
        font-size: 14px;
      }
      .rows {
        list-style: none;
        margin: 0;
        padding: 8px 20px;
      }
      .rows li {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 9px 0;
        border-bottom: 1px solid var(--tq-border);
      }
      .rows li:last-child {
        border-bottom: none;
      }
      .label {
        font-size: 14px;
        color: var(--tq-text);
      }
      .keys {
        display: flex;
        gap: 4px;
      }
      .panel__foot {
        padding: 12px 20px;
        font-size: 12px;
        color: var(--tq-text-muted);
        background: var(--tq-surface-alt);
      }
      kbd {
        font-family: var(--tq-font-mono);
        font-size: 12px;
        background: var(--tq-surface-alt);
        border: 1px solid var(--tq-border-strong);
        border-bottom-width: 2px;
        border-radius: 5px;
        padding: 2px 7px;
        color: var(--tq-text);
      }
      .panel__foot kbd {
        background: var(--tq-surface);
      }
    `,
  ],
})
export class ShortcutsHelpComponent {
  readonly shortcuts = inject(KeyboardShortcutsService);

  readonly rows: HelpRow[] = [
    { keys: ['G', 'D'], label: 'Vai a Dashboard' },
    { keys: ['G', 'Q'], label: 'Vai a Quest' },
    { keys: ['G', 'M'], label: 'Vai a Mappa quest' },
    { keys: ['G', 'S'], label: 'Vai a Impostazioni' },
    { keys: ['C'], label: 'Nuova quest' },
    { keys: ['⌘', 'K'], label: 'Command palette' },
    { keys: ['Esc'], label: 'Chiudi overlay' },
  ];

  @HostListener('document:keydown.escape')
  onEsc(): void {
    this.shortcuts.closeHelp();
  }
}
