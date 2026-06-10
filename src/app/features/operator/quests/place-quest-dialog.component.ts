import { AfterViewInit, Component, inject, NgZone, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';
import { QuestMapPickerComponent } from '../../../shared/components/quest-map-picker/quest-map-picker.component';

export interface PlaceQuestDialogData {
  questName: string;
  mode: 'place' | 'update';
  currentPosition?: { lat: number; lng: number } | null;
}

export interface PlaceQuestDialogResult {
  exactPosition: { lat: number; lng: number };
  fix?: { accuracy: number; clientTimestamp: number };
  scannedToken?: string;
}

type InputMode = 'gps' | 'map';

@Component({
  selector: 'app-place-quest-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    QuestMapPickerComponent,
  ],
  template: `
    <div class="dialog-wrap">
      <div class="dialog-header">
        <h2 class="dialog-title">
          {{ data.mode === 'place' ? 'Piazza QR' : 'Aggiorna posizione' }}
        </h2>
        <p class="dialog-sub">{{ data.questName }}</p>
      </div>

      <div mat-dialog-content class="dialog-content">
        @if (data.mode === 'place') {
          <!-- ── PLACE MODE: scanner QR + GPS auto ────────────────────── -->

          <!-- Sezione QR scanner -->
          <div class="place-section">
            <div class="section-head">
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <path d="M14 14h3v3M17 14h3M14 17v3M17 20h3M20 17v3" />
              </svg>
              Scansiona il QR code
            </div>

            @if (scannedToken()) {
              <div class="status-ok" role="status">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                  stroke-linecap="round"
                  aria-hidden="true"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                QR acquisito correttamente
              </div>
            } @else if (!showManualInput()) {
              <div
                [id]="scannerId"
                class="scanner-box"
                aria-label="Lettore QR via fotocamera"
              ></div>
              @if (scanError()) {
                <div class="place-alert" role="alert">{{ scanError() }}</div>
              }
              <button type="button" class="tq-link-btn" (click)="switchToManual()">
                Inserisci token manualmente
              </button>
            } @else {
              <div class="manual-wrap">
                <input
                  class="manual-input"
                  type="text"
                  [value]="manualToken()"
                  (input)="manualToken.set($any($event.target).value)"
                  placeholder="Incolla il token del QR…"
                  aria-label="Token QR inserimento manuale"
                  autocomplete="off"
                  autocorrect="off"
                  spellcheck="false"
                />
                <button
                  type="button"
                  mat-flat-button
                  color="primary"
                  (click)="confirmManualToken()"
                  [disabled]="!manualToken().trim()"
                >
                  Conferma
                </button>
              </div>
              @if (!scannerUnavailable()) {
                <button type="button" class="tq-link-btn" (click)="switchToCamera()">
                  Riprova con la fotocamera
                </button>
              }
            }
          </div>

          <!-- Sezione GPS -->
          <div class="place-section">
            <div class="section-head">
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
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="12" r="3" />
                <line x1="12" y1="2" x2="12" y2="6" />
                <line x1="12" y1="18" x2="12" y2="22" />
                <line x1="2" y1="12" x2="6" y2="12" />
                <line x1="18" y1="12" x2="22" y2="12" />
              </svg>
              Posizione GPS
            </div>

            @if (gpsLoading()) {
              <div class="gps-loading" role="status">
                <mat-spinner diameter="14" />
                Acquisendo posizione…
              </div>
            } @else if (gpsFix()) {
              <div class="status-ok gps-result">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                  stroke-linecap="round"
                  aria-hidden="true"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <div class="gps-coords">
                  <span class="coord-label">Lat</span>
                  <span class="coord-val">{{ gpsFix()!.lat.toFixed(6) }}</span>
                  <span class="coord-label">Lng</span>
                  <span class="coord-val">{{ gpsFix()!.lng.toFixed(6) }}</span>
                  <span class="gps-acc">±{{ gpsFix()!.accuracy.toFixed(0) }} m</span>
                </div>
              </div>
            } @else {
              <div class="place-alert" role="alert">{{ gpsError() }}</div>
              <button type="button" class="gps-retry-btn" (click)="acquireGps()">
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
                  <polyline points="1 4 1 10 7 10" />
                  <path d="M3.51 15a9 9 0 102.13-9.36L1 10" />
                </svg>
                Riprova GPS
              </button>
            }
          </div>
        } @else {
          <!-- ── UPDATE MODE: GPS manuale o mappa (comportamento precedente) ── -->

          <div class="mode-tabs" role="group" aria-label="Metodo di acquisizione posizione">
            <button
              type="button"
              class="mode-tab"
              [class.mode-tab--active]="inputMode() === 'gps'"
              (click)="setMode('gps')"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="12" r="3" />
                <line x1="12" y1="2" x2="12" y2="6" />
                <line x1="12" y1="18" x2="12" y2="22" />
                <line x1="2" y1="12" x2="6" y2="12" />
                <line x1="18" y1="12" x2="22" y2="12" />
              </svg>
              GPS
            </button>
            <button
              type="button"
              class="mode-tab"
              [class.mode-tab--active]="inputMode() === 'map'"
              (click)="setMode('map')"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                aria-hidden="true"
              >
                <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
                <line x1="8" y1="2" x2="8" y2="18" />
                <line x1="16" y1="6" x2="16" y2="22" />
              </svg>
              Mappa
            </button>
          </div>

          @if (inputMode() === 'gps') {
            <div class="gps-panel">
              @if (gpsError()) {
                <div class="gps-alert" role="alert">{{ gpsError() }}</div>
              }

              <button
                type="button"
                class="gps-btn"
                (click)="acquireGps()"
                [disabled]="gpsLoading()"
                aria-label="Acquisisci posizione GPS"
              >
                @if (gpsLoading()) {
                  <mat-spinner diameter="18" />
                } @else {
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <circle cx="12" cy="12" r="3" />
                    <line x1="12" y1="2" x2="12" y2="6" />
                    <line x1="12" y1="18" x2="12" y2="22" />
                    <line x1="2" y1="12" x2="6" y2="12" />
                    <line x1="18" y1="12" x2="22" y2="12" />
                  </svg>
                }
                Usa la mia posizione
              </button>

              @if (gpsFix()) {
                <div class="gps-result-box">
                  <div class="gps-coords">
                    <span class="coord-label">Lat</span>
                    <span class="coord-val">{{ gpsFix()!.lat.toFixed(6) }}</span>
                    <span class="coord-label">Lng</span>
                    <span class="coord-val">{{ gpsFix()!.lng.toFixed(6) }}</span>
                  </div>
                  <div class="gps-accuracy">
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      aria-hidden="true"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Precisione: {{ gpsFix()!.accuracy.toFixed(0) }} m
                  </div>
                </div>
              }
            </div>
          } @else {
            <div class="map-panel">
              <app-quest-map-picker [formControl]="form.controls.mapPosition" [radius]="50" />
            </div>
          }
        }
      </div>

      <div mat-dialog-actions align="end" class="dialog-actions">
        <button mat-stroked-button type="button" [mat-dialog-close]="undefined">Annulla</button>
        <button
          mat-flat-button
          color="primary"
          type="button"
          [disabled]="!canConfirm()"
          (click)="confirm()"
        >
          {{ data.mode === 'place' ? 'Piazza QR' : 'Aggiorna posizione' }}
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      .dialog-wrap {
        display: flex;
        flex-direction: column;
        min-width: 320px;
        max-width: 560px;
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
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 360px;
      }

      .dialog-content {
        padding: 16px 20px !important;
      }

      /* ── Place mode sections ──────────────────────────────────── */

      .place-section {
        display: flex;
        flex-direction: column;
        gap: 10px;
        margin-bottom: 16px;

        &:last-child {
          margin-bottom: 0;
        }
      }

      .section-head {
        display: flex;
        align-items: center;
        gap: 7px;
        font-size: 12px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.07em;
        color: var(--tq-text-muted);
      }

      .scanner-box {
        width: 100%;
        min-height: 240px;
        border-radius: var(--tq-r);
        overflow: hidden;
        border: 1px solid var(--tq-border);
        background: #111;
        position: relative;
      }

      /* html5-qrcode injects a video element; make it fill the box */
      .scanner-box video {
        width: 100% !important;
        height: 100% !important;
        object-fit: cover;
      }

      /* Override html5-qrcode header/footer UI inside the box */
      ::ng-deep .scanner-box #html5-qrcode-anchor-scan-type-change,
      ::ng-deep .scanner-box #html5-qrcode-button-camera-permission,
      ::ng-deep .scanner-box #html5-qrcode-button-camera-stop {
        display: none !important;
      }

      .place-alert {
        padding: 10px 14px;
        background: var(--tq-danger-light);
        border: 1px solid rgba(155, 28, 28, 0.2);
        border-radius: var(--tq-r-sm);
        color: var(--tq-danger);
        font-size: 13px;
        line-height: 1.5;
      }

      .status-ok {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 14px;
        background: color-mix(in srgb, var(--tq-primary) 10%, transparent);
        border: 1px solid color-mix(in srgb, var(--tq-primary) 25%, transparent);
        border-radius: var(--tq-r-sm);
        color: var(--tq-primary);
        font-size: 13px;
        font-weight: 500;
      }

      .gps-result {
        align-items: flex-start;
      }

      .gps-coords {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
        font-size: 13px;
      }

      .coord-label {
        font-size: 10.5px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--tq-text-subtle);
      }

      .coord-val {
        font-family: var(--tq-font-mono);
        color: var(--tq-text);
        font-size: 13px;
      }

      .gps-acc {
        font-size: 11.5px;
        color: var(--tq-text-muted);
        margin-left: 4px;
      }

      .gps-loading {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 13px;
        color: var(--tq-text-muted);
        padding: 8px 0;
      }

      .manual-wrap {
        display: flex;
        gap: 8px;
        align-items: stretch;
      }

      .manual-input {
        flex: 1;
        padding: 10px 12px;
        border: 1.5px solid var(--tq-border);
        border-radius: var(--tq-r-sm);
        font-family: var(--tq-font-mono);
        font-size: 13px;
        color: var(--tq-text);
        background: var(--tq-surface);
        outline: none;
        min-width: 0;

        &:focus {
          border-color: var(--tq-primary);
        }
      }

      .gps-retry-btn {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 9px 14px;
        border-radius: var(--tq-r-sm);
        border: 1.5px solid var(--tq-border);
        background: var(--tq-surface-alt);
        color: var(--tq-text-muted);
        font-size: 13px;
        font-family: var(--tq-font-body);
        font-weight: 500;
        cursor: pointer;
        align-self: flex-start;
        transition: all 150ms;

        &:hover {
          border-color: var(--tq-primary);
          color: var(--tq-primary);
          background: var(--tq-primary-light);
        }

        @media (max-width: 600px) {
          min-height: 44px;
        }
      }

      .tq-link-btn {
        background: none;
        border: none;
        padding: 0;
        font-size: 12px;
        color: var(--tq-primary);
        cursor: pointer;
        text-decoration: underline;
        font-family: var(--tq-font-body);
        align-self: flex-start;

        &:hover {
          opacity: 0.75;
        }
      }

      /* ── Update mode (unchanged) ──────────────────────────────── */

      .mode-tabs {
        display: flex;
        gap: 6px;
        margin-bottom: 16px;
      }

      .mode-tab {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 8px 14px;
        border-radius: 8px;
        border: 1.5px solid var(--tq-border);
        background: var(--tq-surface-alt);
        color: var(--tq-text-muted);
        font-size: 13px;
        font-family: var(--tq-font-body);
        font-weight: 500;
        cursor: pointer;
        transition: all 150ms;

        &:hover {
          border-color: var(--tq-primary);
          color: var(--tq-primary);
        }
      }

      .mode-tab--active {
        border-color: var(--tq-primary);
        background: var(--tq-primary-light);
        color: var(--tq-primary);
      }

      .gps-panel {
        display: flex;
        flex-direction: column;
        gap: 12px;
        min-height: 140px;
        justify-content: flex-start;
        align-items: stretch;
      }

      .gps-alert {
        padding: 10px 14px;
        background: var(--tq-danger-light);
        border: 1px solid rgba(155, 28, 28, 0.2);
        border-radius: var(--tq-r-sm);
        color: var(--tq-danger);
        font-size: 13px;
        line-height: 1.5;
      }

      .gps-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        width: 100%;
        padding: 16px;
        border-radius: var(--tq-r);
        border: 2px dashed var(--tq-border-strong);
        background: var(--tq-surface-alt);
        color: var(--tq-text);
        font-size: 15px;
        font-family: var(--tq-font-body);
        font-weight: 500;
        cursor: pointer;
        transition: all 150ms;

        &:hover:not(:disabled) {
          border-color: var(--tq-primary);
          color: var(--tq-primary);
          background: var(--tq-primary-light);
        }

        &:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      }

      .gps-result-box {
        padding: 12px 14px;
        border: 1px solid var(--tq-border);
        border-radius: var(--tq-r-sm);
        background: var(--tq-surface);
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .gps-accuracy {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 12px;
        color: var(--tq-primary);
        font-weight: 500;
      }

      .map-panel {
        height: 320px;
        border-radius: var(--tq-r);
        overflow: hidden;
        border: 1px solid var(--tq-border);
      }

      .dialog-actions {
        padding: 8px 20px 16px !important;
        gap: 8px;
      }
    `,
  ],
})
export class PlaceQuestDialogComponent implements AfterViewInit, OnDestroy {
  readonly data = inject<PlaceQuestDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<PlaceQuestDialogComponent>);
  private readonly fb = inject(FormBuilder);
  private readonly ngZone = inject(NgZone);

  readonly form = this.fb.group({
    mapPosition: [null as { lat: number; lng: number; radius: number } | null],
  });

  /* ── Shared (both modes) ── */
  readonly inputMode = signal<InputMode>('gps');
  readonly gpsLoading = signal(false);
  readonly gpsError = signal<string | null>(null);
  readonly gpsFix = signal<{
    lat: number;
    lng: number;
    accuracy: number;
    clientTimestamp: number;
  } | null>(null);

  /* ── Place mode only ── */
  readonly scannerId = `qr-scanner-${Math.random().toString(36).slice(2, 9)}`;
  readonly scannedToken = signal<string | null>(null);
  readonly scanError = signal<string | null>(null);
  readonly showManualInput = signal(false);
  readonly scannerUnavailable = signal(false);
  readonly manualToken = signal('');
  private scanner?: Html5Qrcode;

  /** Id del watch GPS attivo: la posizione si aggiorna mentre l'operatore si
   * muove, così il QR viene piazzato sul punto reale e non sulla prima lettura. */
  private gpsWatchId: number | null = null;

  ngAfterViewInit(): void {
    if (this.data.mode === 'place') {
      this.acquireGps();
      void this.startScanner();
    }
  }

  async ngOnDestroy(): Promise<void> {
    this.stopGpsWatch();
    await this.stopScanner();
  }

  private async startScanner(): Promise<void> {
    try {
      const cameras = await Html5Qrcode.getCameras();
      if (cameras.length === 0) {
        this.ngZone.run(() => {
          this.scannerUnavailable.set(true);
          this.scanError.set('Nessuna fotocamera rilevata. Inserisci il token manualmente.');
          this.showManualInput.set(true);
        });
        return;
      }

      this.scanner = new Html5Qrcode(this.scannerId);
      await this.scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 200, height: 200 } },
        (decodedText) => {
          this.ngZone.run(() => {
            this.scannedToken.set(decodedText);
            void this.stopScanner();
          });
        },
        () => {
          /* single-frame decode errors are normal — ignore */
        },
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message.toLowerCase() : '';
      this.ngZone.run(() => {
        if (msg.includes('permission') || msg.includes('notallowed') || msg.includes('denied')) {
          this.scanError.set('Permesso fotocamera negato. Inserisci il token manualmente.');
        } else if (msg.includes('notfound') || msg.includes('no cameras')) {
          this.scannerUnavailable.set(true);
          this.scanError.set('Nessuna fotocamera disponibile.');
        } else {
          this.scanError.set('Fotocamera non disponibile. Inserisci il token manualmente.');
        }
        this.showManualInput.set(true);
      });
    }
  }

  private async stopScanner(): Promise<void> {
    if (!this.scanner) return;
    try {
      const state = this.scanner.getState();
      if (state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED) {
        await this.scanner.stop();
      }
    } catch {
      /* ignore cleanup errors */
    }
  }

  switchToManual(): void {
    void this.stopScanner();
    this.showManualInput.set(true);
  }

  switchToCamera(): void {
    this.showManualInput.set(false);
    this.scanError.set(null);
    void this.startScanner();
  }

  confirmManualToken(): void {
    const token = this.manualToken().trim();
    if (token) this.scannedToken.set(token);
  }

  canConfirm(): boolean {
    if (this.data.mode === 'place') {
      return this.scannedToken() !== null && this.gpsFix() !== null;
    }
    if (this.inputMode() === 'gps') return this.gpsFix() !== null;
    return this.form.controls.mapPosition.value !== null;
  }

  setMode(mode: InputMode): void {
    this.inputMode.set(mode);
  }

  /**
   * Avvia (o riavvia) un watch GPS continuo: la posizione viene aggiornata a
   * ogni rilevazione del dispositivo, così se l'operatore si sposta il fix
   * segue il movimento reale invece di restare bloccato sulla prima lettura.
   * Il watch resta attivo finché il dialog è aperto (chiuso in ngOnDestroy).
   */
  acquireGps(): void {
    if (!navigator.geolocation) {
      this.gpsError.set('Il GPS non è supportato da questo browser.');
      return;
    }

    // Riparte pulito: evita watch duplicati su "Riprova GPS".
    this.stopGpsWatch();
    this.gpsLoading.set(true);
    this.gpsError.set(null);

    this.gpsWatchId = navigator.geolocation.watchPosition(
      (position) => {
        // I callback di geolocation girano fuori dalla zona Angular.
        this.ngZone.run(() => {
          this.gpsLoading.set(false);
          this.gpsError.set(null);
          this.gpsFix.set({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            clientTimestamp: Date.now(),
          });
        });
      },
      (geolocationError) => {
        this.ngZone.run(() => {
          this.gpsLoading.set(false);
          if (geolocationError.code === 1) {
            // Permesso negato: inutile continuare a osservare.
            this.stopGpsWatch();
            this.gpsError.set(
              'Permesso GPS negato. Abilita il GPS nelle impostazioni del browser.',
            );
          } else if (geolocationError.code === 2) {
            this.gpsError.set('Posizione non disponibile. Assicurati di avere segnale GPS.');
          } else {
            this.gpsError.set("Timeout GPS. Prova ad uscire all'aperto e riprova.");
          }
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      },
    );
  }

  /** Ferma il watch GPS in corso, se presente. */
  private stopGpsWatch(): void {
    if (this.gpsWatchId !== null) {
      navigator.geolocation.clearWatch(this.gpsWatchId);
      this.gpsWatchId = null;
    }
  }

  confirm(): void {
    if (!this.canConfirm()) return;

    let result: PlaceQuestDialogResult;

    if (this.data.mode === 'place') {
      const fix = this.gpsFix()!;
      result = {
        exactPosition: { lat: fix.lat, lng: fix.lng },
        fix: { accuracy: fix.accuracy, clientTimestamp: fix.clientTimestamp },
        scannedToken: this.scannedToken()!,
      };
    } else if (this.inputMode() === 'gps') {
      const fix = this.gpsFix()!;
      result = {
        exactPosition: { lat: fix.lat, lng: fix.lng },
        fix: { accuracy: fix.accuracy, clientTimestamp: fix.clientTimestamp },
      };
    } else {
      const pos = this.form.controls.mapPosition.value!;
      result = { exactPosition: { lat: pos.lat, lng: pos.lng } };
    }

    this.dialogRef.close(result);
  }
}
