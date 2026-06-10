import {
  AfterViewInit,
  Component,
  ElementRef,
  inject,
  OnDestroy,
  signal,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import * as L from 'leaflet';
import { OperatorQuestView, PlacementStatus } from '@trentino-quest/shared-types';
import { OperatorService } from '../../../core/services/operator.service';
import {
  createOsmTileLayer,
  TRENTINO_CENTER,
  TRENTINO_ZOOM,
} from '../../../shared/leaflet/leaflet-config';
import {
  PlaceQuestDialogComponent,
  PlaceQuestDialogData,
  PlaceQuestDialogResult,
} from './place-quest-dialog.component';
import { firstValueFrom } from 'rxjs';

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

@Component({
  selector: 'app-operator-quests-map',
  standalone: true,
  imports: [CommonModule, RouterLink, MatDialogModule, MatSnackBarModule],
  template: `
    <div class="op-map-page">
      <header class="map-page-head">
        <div>
          <h1 class="tq-page-title">Mappa quest</h1>
          <p class="tq-page-subtitle">Aree di ricerca delle quest da piazzare sul territorio.</p>
        </div>
        <a routerLink="/operator/list" class="tq-btn-ghost back-btn">
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
            <line x1="8" y1="6" x2="21" y2="6" />
            <line x1="8" y1="12" x2="21" y2="12" />
            <line x1="8" y1="18" x2="21" y2="18" />
            <line x1="3" y1="6" x2="3.01" y2="6" />
            <line x1="3" y1="12" x2="3.01" y2="12" />
            <line x1="3" y1="18" x2="3.01" y2="18" />
          </svg>
          Lista
        </a>
      </header>

      <div class="map-layout">
        <div class="quest-sidebar" role="list" aria-label="Quest da piazzare">
          @if (isLoading()) {
            <div class="sidebar-state">Caricamento…</div>
          } @else if (quests().length === 0) {
            <div class="sidebar-state">Nessuna quest da piazzare.</div>
          } @else {
            @for (quest of quests(); track quest.id) {
              <div
                class="quest-item"
                [class.quest-item--selected]="selectedId() === quest.id"
                role="listitem"
                tabindex="0"
                (click)="focusQuest(quest)"
                (keydown.enter)="focusQuest(quest)"
              >
                <div class="qi-name">{{ quest.name }}</div>
                <div class="qi-area">
                  {{ quest.searchArea.lat.toFixed(4) }}, {{ quest.searchArea.lng.toFixed(4) }} ·
                  {{ quest.searchRadiusMeters }} m
                </div>
                <button
                  type="button"
                  class="tq-btn-primary qi-btn"
                  (click)="$event.stopPropagation(); onPlace(quest)"
                  [attr.aria-label]="'Piazza QR per ' + quest.name"
                >
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
                  Piazza QR
                </button>
              </div>
            }
          }
        </div>

        <div #mapContainer class="map-container"></div>
      </div>
    </div>
  `,
  styles: [
    `
      .op-map-page {
        display: flex;
        flex-direction: column;
        height: 100%;
        padding: 0 16px 16px;

        @media (min-width: 600px) {
          padding: 0 28px 24px;
        }
      }

      .map-page-head {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 12px;
        flex-wrap: wrap;
        margin-bottom: 16px;
        flex-shrink: 0;
      }

      .back-btn {
        flex-shrink: 0;
        text-decoration: none;
      }

      /* ── Split layout ── */
      .map-layout {
        display: flex;
        gap: 0;
        flex: 1;
        min-height: 400px;
        border: 1px solid var(--tq-border);
        border-radius: var(--tq-r);
        overflow: hidden;

        @media (max-width: 768px) {
          flex-direction: column;
        }
      }

      /* ── Sidebar ── */
      .quest-sidebar {
        width: 280px;
        min-width: 280px;
        overflow-y: auto;
        border-right: 1px solid var(--tq-border);
        background: var(--tq-surface);

        @media (max-width: 768px) {
          width: 100%;
          min-width: unset;
          max-height: 200px;
          border-right: none;
          border-bottom: 1px solid var(--tq-border);
        }
      }

      .sidebar-state {
        padding: 32px 16px;
        text-align: center;
        color: var(--tq-text-muted);
        font-size: 13.5px;
      }

      .quest-item {
        padding: 14px 16px;
        border-bottom: 1px solid var(--tq-border);
        cursor: pointer;
        transition: background 120ms;
        display: flex;
        flex-direction: column;
        gap: 4px;

        &:hover {
          background: var(--tq-surface-alt);
        }

        &.quest-item--selected {
          background: var(--tq-primary-light);
          border-left: 3px solid var(--tq-primary);
        }
      }

      .qi-name {
        font-size: 13.5px;
        font-weight: 600;
        color: var(--tq-text);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .qi-area {
        font-size: 11.5px;
        color: var(--tq-text-subtle);
        font-family: var(--tq-font-mono);
      }

      .qi-btn {
        align-self: flex-start;
        margin-top: 6px;
        font-size: 12px !important;
        padding: 7px 10px !important;

        @media (max-width: 600px) {
          align-self: stretch;
          justify-content: center;
          min-height: 44px;
        }
      }

      /* ── Map ── */
      .map-container {
        flex: 1;
        min-height: 300px;

        @media (max-width: 768px) {
          height: 55vh;
        }
      }
    `,
  ],
})
export class OperatorQuestsMapPage implements AfterViewInit, OnDestroy {
  private readonly service = inject(OperatorService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);

  readonly isLoading = signal(true);
  readonly quests = signal<OperatorQuestView[]>([]);
  readonly selectedId = signal<string | null>(null);

  @ViewChild('mapContainer') mapContainerRef?: ElementRef<HTMLDivElement>;

  private map?: L.Map;
  private layerGroup?: L.LayerGroup;
  private clickListener?: (e: MouseEvent) => void;
  private userDot?: L.CircleMarker;
  private userRing?: L.Circle;

  ngAfterViewInit(): void {
    this.initMap();
    void this.locateUser();
    void this.load();
  }

  ngOnDestroy(): void {
    if (this.clickListener && this.map) {
      this.map.getContainer().removeEventListener('click', this.clickListener);
    }
    this.map?.remove();
  }

  private initMap(): void {
    if (!this.mapContainerRef) return;
    this.map = L.map(this.mapContainerRef.nativeElement, {
      center: TRENTINO_CENTER,
      zoom: TRENTINO_ZOOM,
      zoomControl: true,
    });
    createOsmTileLayer().addTo(this.map);
    this.layerGroup = L.layerGroup().addTo(this.map);

    this.clickListener = (e: MouseEvent) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-place-id]');
      if (btn?.dataset['placeId']) {
        const quest = this.quests().find((q) => q.id === btn.dataset['placeId']);
        if (quest) void this.onPlace(quest);
      }
    };
    this.map.getContainer().addEventListener('click', this.clickListener);
  }

  private async locateUser(): Promise<void> {
    if (!navigator.geolocation || !this.map) return;
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 12000,
        });
      });
      const { latitude: lat, longitude: lng, accuracy } = pos.coords;

      this.userRing = L.circle([lat, lng], {
        radius: accuracy,
        color: '#1a6cc4',
        fillColor: '#1a6cc4',
        fillOpacity: 0.08,
        weight: 1.5,
        dashArray: '4 3',
      }).addTo(this.map!);

      this.userDot = L.circleMarker([lat, lng], {
        radius: 8,
        color: '#fff',
        fillColor: '#1a6cc4',
        fillOpacity: 1,
        weight: 2.5,
      })
        .bindTooltip('Sei qui', { permanent: false, direction: 'top' })
        .addTo(this.map!);

      this.map!.setView([lat, lng], 14);
    } catch {
      /* GPS negato o non disponibile — rimane sulla vista default */
    }
  }

  async load(): Promise<void> {
    this.isLoading.set(true);
    try {
      const res = await this.service.list({ placementStatus: PlacementStatus.PENDING });
      this.quests.set(res.data);
      this.renderMap();
    } catch {
      this.snackBar.open('Errore nel caricamento delle quest', 'OK', { duration: 3000 });
    } finally {
      this.isLoading.set(false);
    }
  }

  focusQuest(quest: OperatorQuestView): void {
    this.selectedId.set(quest.id);
    this.renderMap();
    if (this.map) {
      this.map.flyTo([quest.searchArea.lat, quest.searchArea.lng], 15, { duration: 0.7 });
    }
  }

  private renderMap(): void {
    if (!this.layerGroup) return;
    this.layerGroup.clearLayers();

    const allLatLngs: L.LatLng[] = [];

    for (const quest of this.quests()) {
      const { lat, lng } = quest.searchArea;
      const r = quest.searchRadiusMeters;
      const isSelected = quest.id === this.selectedId();

      const circle = L.circle([lat, lng], {
        radius: r,
        color: isSelected ? '#1a5c38' : '#5a8f6e',
        fillColor: isSelected ? '#1a5c38' : '#5a8f6e',
        fillOpacity: isSelected ? 0.12 : 0.06,
        weight: isSelected ? 2 : 1.5,
        dashArray: isSelected ? undefined : '6 4',
      });

      const dot = L.circleMarker([lat, lng], {
        radius: isSelected ? 7 : 5,
        color: '#fff',
        fillColor: '#1a5c38',
        fillOpacity: 1,
        weight: 2,
      });

      const popupContent = this.buildPopupHtml(quest);
      const popupOpts: L.PopupOptions = { className: 'tq-leaflet-popup', maxWidth: 220 };
      circle.bindPopup(popupContent, popupOpts);
      dot.bindPopup(popupContent, popupOpts);

      circle.on('click', () => {
        this.selectedId.set(quest.id);
        this.renderMap();
      });
      dot.on('click', () => {
        this.selectedId.set(quest.id);
        this.renderMap();
      });

      this.layerGroup.addLayer(circle);
      this.layerGroup.addLayer(dot);
      allLatLngs.push(L.latLng(lat, lng));
    }

    // Auto-fit to quest bounds only when GPS position is not known
    if (allLatLngs.length > 0 && this.map && this.selectedId() === null && !this.userDot) {
      const bounds = L.latLngBounds(allLatLngs);
      this.map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }
  }

  private buildPopupHtml(quest: OperatorQuestView): string {
    return `
      <div style="font-family:var(--tq-font-body);min-width:180px">
        <div style="font-size:13px;font-weight:700;color:var(--tq-text);margin-bottom:4px">
          ${esc(quest.name ?? '')}
        </div>
        <div style="font-size:11.5px;color:var(--tq-text-muted);margin-bottom:10px">
          ${quest.searchArea.lat.toFixed(4)}, ${quest.searchArea.lng.toFixed(4)}<br>
          Raggio: ${quest.searchRadiusMeters} m
        </div>
        <button
          data-place-id="${esc(quest.id)}"
          style="width:100%;background:#1a5c38;color:#fff;border:none;border-radius:6px;
                 padding:8px 12px;font-size:12.5px;font-weight:500;cursor:pointer;
                 font-family:var(--tq-font-body)"
        >
          Piazza QR
        </button>
      </div>`;
  }

  async onPlace(quest: OperatorQuestView): Promise<void> {
    const data: PlaceQuestDialogData = {
      questName: quest.name ?? quest.id,
      mode: 'place',
    };
    const result = (await firstValueFrom(
      this.dialog
        .open(PlaceQuestDialogComponent, { data, width: '580px', maxWidth: '95vw' })
        .afterClosed(),
    )) as PlaceQuestDialogResult | undefined;

    if (!result) return;

    try {
      await this.service.place(quest.id, {
        exactPosition: result.exactPosition,
        scannedToken: result.scannedToken ?? '',
        fix: result.fix,
      });
      this.snackBar.open(`QR piazzato per "${quest.name}"`, 'OK', { duration: 3000 });
      void this.load();
    } catch (err) {
      this.showPlacementError(err);
    }
  }

  private showPlacementError(err: unknown): void {
    if (err instanceof HttpErrorResponse) {
      const code = (err.error as { code?: string })?.code;
      if (err.status === 409) {
        if (code === 'QR_TOKEN_MISMATCH') {
          this.snackBar.open(
            'Questo QR non appartiene a questa quest. Controlla di aver scansionato il QR giusto.',
            'Chiudi',
            { duration: 7000 },
          );
          return;
        }
        if (code === 'QUEST_QR_NOT_GENERATED') {
          this.snackBar.open("Il QR non è ancora stato generato dall'amministratore.", 'Chiudi', {
            duration: 6000,
          });
          return;
        }
        if (code === 'QUEST_ALREADY_PLACED') {
          this.snackBar.open('Il QR è già stato piazzato per questa quest.', 'Chiudi', {
            duration: 5000,
          });
          return;
        }
      }
      if (err.status === 422) {
        if (code === 'OUT_OF_RANGE_ACCURACY') {
          this.snackBar.open(
            "Posizione GPS imprecisa, riprova all'aperto con cielo libero.",
            'Chiudi',
            { duration: 6000 },
          );
          return;
        }
        if (code === 'STALE_FIX') {
          this.snackBar.open(
            'Fix GPS troppo vecchio. Riacquisisci la posizione e riprova subito.',
            'Chiudi',
            { duration: 6000 },
          );
          return;
        }
      }
    }
    const detail =
      err instanceof HttpErrorResponse
        ? ((err.error as { message?: string })?.message ?? `HTTP ${err.status}`)
        : 'Errore sconosciuto';
    this.snackBar.open(`Errore nel piazzamento: ${detail}`, 'Chiudi', { duration: 5000 });
  }
}
