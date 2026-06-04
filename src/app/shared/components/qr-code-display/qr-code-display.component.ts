import { AfterViewInit, Component, ElementRef, inject, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import type { PrimaryQuest } from '@trentino-quest/shared-types';
import * as QRCode from 'qrcode';

export type QrCodeDisplayData = PrimaryQuest;

@Component({
  selector: 'app-qr-code-display',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule],
  template: `
    <div class="dialog-wrap">
      <div class="dialog-header">
        <h2 class="dialog-title">QR Code</h2>
        <p class="dialog-sub">{{ quest.name }}</p>
      </div>
      <div mat-dialog-content class="dialog-content">
        <div class="qr-frame">
          <div class="qr-brand">
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              aria-hidden="true"
            >
              <polyline points="3 17 7 9 11 13 15 7 19 13" />
              <line x1="3" y1="20" x2="21" y2="20" />
            </svg>
            Trentino Quest
          </div>
          <canvas #qrCanvas class="qr-canvas"></canvas>
          <div class="qr-name">{{ quest.name }}</div>
          <div class="qr-hint">Consegna all'operatore per il piazzamento sul campo</div>
        </div>
      </div>
      <div mat-dialog-actions align="end" class="dialog-actions">
        <button mat-stroked-button type="button" [mat-dialog-close]="undefined">Chiudi</button>
        <button mat-flat-button color="primary" type="button" (click)="print()">
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            aria-hidden="true"
          >
            <polyline points="6 9 6 2 18 2 18 9" />
            <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
            <rect x="6" y="14" width="12" height="8" />
          </svg>
          Stampa QR
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      .dialog-wrap {
        display: flex;
        flex-direction: column;
        min-width: 300px;
        max-width: 440px;
        width: 100%;
      }
      .dialog-header {
        padding: 20px 20px 0;
      }
      .dialog-title {
        font-family: var(--tq-font-display);
        font-size: 1.1rem;
        font-weight: 600;
        color: var(--tq-text);
        margin: 0 0 4px;
      }
      .dialog-sub {
        font-size: 13px;
        color: var(--tq-text-muted);
        margin: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 320px;
      }
      .dialog-content {
        padding: 20px !important;
      }
      .qr-frame {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
        padding: 20px;
        border: 1.5px solid var(--tq-border);
        border-radius: var(--tq-r);
        background: var(--tq-surface);
      }
      .qr-brand {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--tq-primary);
      }
      .qr-canvas {
        border-radius: 4px;
        display: block;
      }
      .qr-name {
        font-size: 14px;
        font-weight: 600;
        color: var(--tq-text);
        text-align: center;
        letter-spacing: -0.01em;
      }
      .qr-hint {
        font-size: 11.5px;
        color: var(--tq-text-subtle);
        text-align: center;
      }
      .dialog-actions {
        padding: 8px 20px 16px !important;
        gap: 8px;
      }
    `,
  ],
})
export class QrCodeDisplayComponent implements AfterViewInit {
  readonly quest = inject<QrCodeDisplayData>(MAT_DIALOG_DATA);

  @ViewChild('qrCanvas', { static: true })
  canvasRef!: ElementRef<HTMLCanvasElement>;

  ngAfterViewInit(): void {
    if (this.quest.qrToken) {
      void QRCode.toCanvas(this.canvasRef.nativeElement, this.quest.qrToken, {
        width: 220,
        margin: 2,
        color: { dark: '#1a1a14', light: '#ffffff' },
      });
    }
  }

  print(): void {
    const canvas = this.canvasRef.nativeElement;
    const dataUrl = canvas.toDataURL('image/png');
    const name = this.esc(this.quest.name ?? '');
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(
      `<!DOCTYPE html><html lang="it"><head><meta charset="utf-8">` +
        `<title>QR – ${name}</title>` +
        `<style>*{margin:0;padding:0;box-sizing:border-box}` +
        `body{font-family:'DM Sans',system-ui,sans-serif;display:flex;flex-direction:column;` +
        `align-items:center;justify-content:center;min-height:100vh;padding:40px;` +
        `background:#fff;color:#1a1a14}` +
        `.brand{font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;` +
        `color:#1a5c38;margin-bottom:24px;display:flex;align-items:center;gap:6px}` +
        `.frame{padding:24px;border:2px solid #e8e4dd;border-radius:12px;` +
        `display:flex;flex-direction:column;align-items:center;gap:14px}` +
        `img{width:260px;height:260px;image-rendering:pixelated}` +
        `.qname{font-size:15px;font-weight:600;text-align:center;color:#1a1a14}` +
        `.note{font-size:11px;color:#9a8f7e;text-align:center;margin-top:8px;max-width:280px}` +
        `@media print{@page{margin:20mm}}</style></head>` +
        `<body>` +
        `<div class="brand">` +
        `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">` +
        `<polyline points="3 17 7 9 11 13 15 7 19 13"/><line x1="3" y1="20" x2="21" y2="20"/></svg>` +
        `Trentino Quest</div>` +
        `<div class="frame"><img src="${dataUrl}" alt="QR Code"/><div class="qname">${name}</div></div>` +
        `<div class="note">Affiggere nel punto indicato e scansionare per registrare la posizione</div>` +
        `<script>window.addEventListener('load',function(){window.print();` +
        `window.addEventListener('afterprint',function(){window.close();});});</` +
        `script>` +
        `</body></html>`,
    );
    w.document.close();
  }

  private esc(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
