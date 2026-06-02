import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { QuestMapPickerComponent } from '../../../shared/components/quest-map-picker/quest-map-picker.component';

export interface PlaceQuestDialogData {
  questName: string;
  mode: 'place' | 'update';
  currentPosition?: { lat: number; lng: number } | null;
}

export interface PlaceQuestDialogResult {
  exactPosition: { lat: number; lng: number };
  fix?: { accuracy: number; clientTimestamp: number };
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
              <div class="gps-result">
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

      .gps-result {
        padding: 12px 14px;
        border: 1px solid var(--tq-border);
        border-radius: var(--tq-r-sm);
        background: var(--tq-surface);
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .gps-coords {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        flex-wrap: wrap;
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
export class PlaceQuestDialogComponent {
  readonly data = inject<PlaceQuestDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<PlaceQuestDialogComponent>);
  private readonly fb = inject(FormBuilder);

  readonly form = this.fb.group({
    mapPosition: [null as { lat: number; lng: number; radius: number } | null],
  });

  readonly inputMode = signal<InputMode>('gps');
  readonly gpsLoading = signal(false);
  readonly gpsError = signal<string | null>(null);
  readonly gpsFix = signal<{
    lat: number;
    lng: number;
    accuracy: number;
    clientTimestamp: number;
  } | null>(null);

  canConfirm(): boolean {
    if (this.inputMode() === 'gps') {
      return this.gpsFix() !== null;
    }
    return this.form.controls.mapPosition.value !== null;
  }

  setMode(mode: InputMode): void {
    this.inputMode.set(mode);
  }

  async acquireGps(): Promise<void> {
    if (!navigator.geolocation) {
      this.gpsError.set('Il GPS non è supportato da questo browser.');
      return;
    }

    this.gpsLoading.set(true);
    this.gpsError.set(null);

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
        });
      });

      this.gpsFix.set({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
        clientTimestamp: Date.now(),
      });
    } catch (err) {
      const geolocationError = err as GeolocationPositionError;
      if (geolocationError.code === 1) {
        this.gpsError.set('Permesso GPS negato. Abilita il GPS nelle impostazioni del browser.');
      } else if (geolocationError.code === 2) {
        this.gpsError.set('Posizione non disponibile. Assicurati di avere segnale GPS.');
      } else {
        this.gpsError.set("Timeout GPS. Prova ad uscire all'aperto e riprova.");
      }
    } finally {
      this.gpsLoading.set(false);
    }
  }

  confirm(): void {
    if (!this.canConfirm()) return;

    let result: PlaceQuestDialogResult;

    if (this.inputMode() === 'gps') {
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
