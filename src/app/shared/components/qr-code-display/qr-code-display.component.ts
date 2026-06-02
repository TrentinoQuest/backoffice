import { CommonModule, DOCUMENT } from '@angular/common';
import {
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import * as QRCode from 'qrcode';

export interface QrCodeDisplayData {
  qrToken: string;
  questName: string;
  subtitle?: string;
  note?: string;
}

const QR_PRINT_BODY_CLASS = 'tq-print-qr';

@Component({
  selector: 'app-qr-code-display',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatDialogModule, MatIconModule],
  template: `
    <section class="qr-display" [class.qr-display--dialog]="isDialog()">
      <header class="qr-display__brand">
        <div class="qr-display__brand-mark" aria-hidden="true">
          <mat-icon>terrain</mat-icon>
        </div>
        <div class="qr-display__brand-copy">
          <div class="qr-display__brand-name">Trentino Quest</div>
          <div class="qr-display__brand-role">QR stampabile</div>
        </div>
      </header>

      <div class="qr-display__card">
        <div class="qr-display__meta">
          <p class="qr-display__eyebrow">Quest</p>
          <h2 class="qr-display__title">{{ questName() }}</h2>
          <p class="qr-display__subtitle">{{ subtitle() }}</p>
        </div>

        @if (hasQr()) {
          <div class="qr-display__frame" aria-label="QR code della quest">
            <div class="qr-display__qr" [innerHTML]="qrSvgMarkup()"></div>
          </div>

          <div class="qr-display__note">
            <mat-icon>qr_code_2</mat-icon>
            <span>{{ note() }}</span>
          </div>
        } @else {
          <div class="qr-display__empty">
            <mat-icon>hourglass_empty</mat-icon>
            <div>
              <div class="qr-display__empty-title">QR non ancora disponibile</div>
              <p>Il token compare solo quando la quest principale è stata piazzata.</p>
            </div>
          </div>
        }

        <footer class="qr-display__actions">
          @if (hasQr()) {
            <button type="button" mat-stroked-button (click)="downloadSvg()">
              <mat-icon>download</mat-icon>
              SVG
            </button>
            <button type="button" mat-stroked-button (click)="downloadPng()">
              <mat-icon>image</mat-icon>
              PNG
            </button>
            <button type="button" mat-flat-button color="primary" (click)="printQr()">
              <mat-icon>print</mat-icon>
              Stampa
            </button>
          }

          @if (isDialog()) {
            <button type="button" mat-button mat-dialog-close>
              <mat-icon>close</mat-icon>
              Chiudi
            </button>
          }
        </footer>
      </div>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .qr-display {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        color: var(--tq-text);
      }

      .qr-display__brand {
        display: flex;
        align-items: center;
        gap: 0.8rem;
        padding: 0.25rem 0.25rem 0;
      }

      .qr-display__brand-mark {
        width: 2.5rem;
        height: 2.5rem;
        border-radius: 999px;
        background: linear-gradient(135deg, var(--tq-primary), #0f3e25);
        color: #fff;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 10px 24px rgba(26, 92, 56, 0.22);
        flex-shrink: 0;
      }

      .qr-display__brand-mark mat-icon {
        font-size: 1.35rem;
        width: 1.35rem;
        height: 1.35rem;
      }

      .qr-display__brand-copy {
        display: flex;
        flex-direction: column;
        line-height: 1.1;
      }

      .qr-display__brand-name {
        font-family: var(--tq-font-display);
        font-size: 1.05rem;
        font-weight: 700;
        letter-spacing: -0.02em;
      }

      .qr-display__brand-role {
        font-size: 0.8rem;
        color: var(--tq-text-muted);
      }

      .qr-display__card {
        background:
          radial-gradient(circle at top right, rgba(26, 92, 56, 0.08), transparent 42%),
          linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(247, 244, 239, 0.98));
        border: 1px solid var(--tq-border);
        border-radius: 22px;
        padding: 1.25rem;
        box-shadow: var(--tq-shadow-lg);
      }

      .qr-display__meta {
        display: grid;
        gap: 0.25rem;
        text-align: center;
        margin-bottom: 1rem;
      }

      .qr-display__eyebrow {
        margin: 0;
        font-size: 0.72rem;
        font-weight: 700;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: var(--tq-primary);
      }

      .qr-display__title {
        margin: 0;
        font-family: var(--tq-font-display);
        font-size: 1.45rem;
        font-weight: 700;
        line-height: 1.1;
        letter-spacing: -0.03em;
      }

      .qr-display__subtitle {
        margin: 0;
        color: var(--tq-text-muted);
        font-size: 0.92rem;
        line-height: 1.45;
      }

      .qr-display__frame {
        width: min(100%, 21rem);
        margin: 0 auto;
        padding: 1rem;
        background: #fff;
        border-radius: 18px;
        border: 1px solid var(--tq-border);
        box-shadow: inset 0 0 0 1px rgba(26, 92, 56, 0.05);
      }

      .qr-display__qr {
        width: 100%;
        aspect-ratio: 1;
        display: grid;
        place-items: center;
      }

      .qr-display__qr svg {
        display: block;
        width: 100%;
        height: auto;
      }

      .qr-display__note {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        margin-top: 1rem;
        color: var(--tq-text-muted);
        font-size: 0.92rem;
        text-align: center;
      }

      .qr-display__note mat-icon,
      .qr-display__empty mat-icon {
        width: 1.1rem;
        height: 1.1rem;
        font-size: 1.1rem;
        color: var(--tq-primary);
        flex-shrink: 0;
      }

      .qr-display__empty {
        display: flex;
        align-items: flex-start;
        gap: 0.75rem;
        padding: 1rem;
        border-radius: 18px;
        background: var(--tq-surface-alt);
        border: 1px dashed var(--tq-border-strong);
      }

      .qr-display__empty-title {
        font-weight: 700;
        margin-bottom: 0.15rem;
      }

      .qr-display__empty p {
        margin: 0;
        color: var(--tq-text-muted);
        font-size: 0.92rem;
        line-height: 1.45;
      }

      .qr-display__actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.6rem;
        justify-content: center;
        margin-top: 1rem;
      }

      .qr-display__actions button mat-icon {
        margin-right: 0.35rem;
      }

      @media (max-width: 480px) {
        .qr-display__card {
          padding: 1rem;
          border-radius: 18px;
        }

        .qr-display__title {
          font-size: 1.25rem;
        }

        .qr-display__frame {
          padding: 0.75rem;
        }

        .qr-display__actions {
          justify-content: stretch;
        }

        .qr-display__actions button {
          flex: 1 1 100%;
        }
      }

      @media print {
        .qr-display__brand {
          padding-top: 0;
        }

        .qr-display__card {
          box-shadow: none;
          border: 1px solid #d9d4c8;
          background: #fff;
          break-inside: avoid;
          page-break-inside: avoid;
        }

        .qr-display__actions {
          display: none;
        }
      }
    `,
  ],
  encapsulation: ViewEncapsulation.None,
})
export class QrCodeDisplayComponent {
  private readonly dialogData = inject<QrCodeDisplayData | null>(MAT_DIALOG_DATA, {
    optional: true,
  });
  private readonly sanitizer = inject(DomSanitizer);
  private readonly document = inject(DOCUMENT);

  private renderRun = 0;

  readonly qrToken = input<string | null>(this.dialogData?.qrToken ?? null);
  readonly questName = input<string>(this.dialogData?.questName ?? 'Quest');
  readonly subtitle = input<string>(
    this.dialogData?.subtitle ?? "Inquadra con l'app Trentino Quest",
  );
  readonly note = input<string>(
    this.dialogData?.note ?? 'Stampa e affiggi questo QR sul territorio.',
  );

  readonly qrSvgMarkup = signal<SafeHtml | null>(null);
  readonly hasQr = computed(() => Boolean(this.qrToken()?.trim()));
  readonly isDialog = computed(() => Boolean(this.dialogData));

  constructor() {
    effect(() => {
      const token = this.qrToken();
      void this.renderQr(token);
    });
  }

  private async renderQr(token: string | null): Promise<void> {
    const currentRun = ++this.renderRun;
    if (!token) {
      this.qrSvgMarkup.set(null);
      return;
    }

    const svg = await QRCode.toString(token, {
      type: 'svg',
      errorCorrectionLevel: 'Q',
      margin: 4,
      width: 320,
      color: {
        dark: '#111111',
        light: '#ffffff',
      },
    });

    if (currentRun !== this.renderRun) {
      return;
    }

    this.qrSvgMarkup.set(this.sanitizer.bypassSecurityTrustHtml(svg));
  }

  downloadSvg(): void {
    const token = this.qrToken()?.trim();
    if (!token) return;
    void this.downloadSvgFile(token, this.fileName('svg'));
  }

  async downloadPng(): Promise<void> {
    const token = this.qrToken()?.trim();
    if (!token) return;
    const url = await QRCode.toDataURL(token, {
      errorCorrectionLevel: 'Q',
      margin: 4,
      width: 1024,
      color: {
        dark: '#111111',
        light: '#ffffff',
      },
    });
    this.triggerDownload(url, this.fileName('png'));
  }

  printQr(): void {
    if (!this.hasQr()) return;

    const body = this.document.body;
    const cleanup = (): void => {
      body.classList.remove(QR_PRINT_BODY_CLASS);
      this.document.defaultView?.removeEventListener('afterprint', cleanup);
    };

    body.classList.add(QR_PRINT_BODY_CLASS);
    this.document.defaultView?.addEventListener('afterprint', cleanup, { once: true });
    this.document.defaultView?.setTimeout(() => this.document.defaultView?.print(), 0);
  }

  private async downloadSvgFile(token: string, fileName: string): Promise<void> {
    const svg = await QRCode.toString(token, {
      type: 'svg',
      errorCorrectionLevel: 'Q',
      margin: 4,
      width: 1024,
      color: {
        dark: '#111111',
        light: '#ffffff',
      },
    });
    await this.downloadFile(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), fileName);
  }

  private fileName(extension: 'png' | 'svg'): string {
    const slug = this.slugify(this.questName());
    return `trentino-quest-${slug}-qr.${extension}`;
  }

  private slugify(value: string): string {
    return (
      value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'quest'
    );
  }

  private async downloadFile(blob: Blob, fileName: string): Promise<void> {
    const url = URL.createObjectURL(blob);
    this.triggerDownload(url, fileName);
    this.document.defaultView?.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  private triggerDownload(url: string, fileName: string): void {
    const link = this.document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.rel = 'noopener';
    this.document.body.appendChild(link);
    link.click();
    link.remove();
  }
}
