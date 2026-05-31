import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import * as L from 'leaflet';
import type { AnyQuest, PrimaryQuest } from '@trentino-quest/shared-types';
import { QuestStatus, QuestType } from '@trentino-quest/shared-types';
import { createOsmTileLayer, TRENTINO_CENTER, TRENTINO_ZOOM } from '../../leaflet/leaflet-config';

/** Crea un marker Leaflet custom con lo stile Terrain B */
function createCustomMarker(variant: 'primary' | 'secondary' | 'inactive'): L.DivIcon {
  const colors: Record<typeof variant, string> = {
    primary: '#1a5c38',
    secondary: '#a06010',
    inactive: '#9a8f7e',
  };
  const color = colors[variant];
  const opacity = variant === 'inactive' ? '0.55' : '1';
  const shadow = variant === 'inactive' ? '0.12' : '0.25';
  const html = `
    <div style="transform:translate(-50%,-100%);display:flex;flex-direction:column;align-items:center">
      <div style="width:10px;height:10px;border-radius:50%;background:${color};border:2.5px solid #fff;
                  box-shadow:0 2px 6px rgba(0,0,0,${shadow});opacity:${opacity}"></div>
      <div style="width:2px;height:6px;background:#fff;opacity:0.7"></div>
      <div style="width:8px;height:3px;border-radius:50%;background:rgba(0,0,0,0.2);margin-top:1px;opacity:${opacity}"></div>
    </div>`;
  return L.divIcon({ html, className: '', iconSize: [10, 19], iconAnchor: [5, 19] });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

@Component({
  selector: 'app-quest-map-viewer',
  standalone: true,
  imports: [CommonModule],
  template: `<div #mapContainer class="map-container"></div>`,
  styles: [
    `
      :host {
        display: block;
        height: 100%;
      }
      .map-container {
        width: 100%;
        height: 100%;
      }
    `,
  ],
})
export class QuestMapViewerComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef<HTMLDivElement>;

  @Input() quests: AnyQuest[] = [];
  /** Record<collectibleId, collectibleName> per mostrare nome nel popup */
  @Input() collectiblesById: Record<string, string> = {};
  /** Record<collectibleId, imageUrl> per mostrare immagine nel popup */
  @Input() collectibleImageById: Record<string, string> = {};
  @Input() selectedQuestId: string | null = null;
  @Input() centerOn: { lat: number; lng: number } | null = null;
  /** Se false, disabilita interazione (usato nella dashboard preview) */
  @Input() interactive = true;
  /** Se true, riduce altezza e zoom (usato nella dashboard preview) */
  @Input() compact = false;

  @Output() questSelected = new EventEmitter<string>();

  private map!: L.Map;
  private markersLayer!: L.LayerGroup;
  private clickListener?: (e: MouseEvent) => void;

  ngAfterViewInit(): void {
    this.initMap();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.map) return;
    if (
      changes['quests'] ||
      changes['collectiblesById'] ||
      changes['collectibleImageById'] ||
      changes['selectedQuestId']
    ) {
      this.renderMarkers();
    }
    if (changes['centerOn'] && this.centerOn) {
      this.map.setView([this.centerOn.lat, this.centerOn.lng], 14);
    }
  }

  ngOnDestroy(): void {
    if (this.clickListener) {
      this.map?.getContainer().removeEventListener('click', this.clickListener);
    }
    this.map?.remove();
  }

  private initMap(): void {
    const zoom = this.compact ? TRENTINO_ZOOM - 1 : TRENTINO_ZOOM;
    this.map = L.map(this.mapContainer.nativeElement, {
      center: TRENTINO_CENTER,
      zoom,
      zoomControl: this.interactive,
      scrollWheelZoom: this.interactive,
      dragging: this.interactive,
      touchZoom: this.interactive,
      doubleClickZoom: this.interactive,
      boxZoom: this.interactive,
      keyboard: this.interactive,
    });

    createOsmTileLayer().addTo(this.map);

    this.markersLayer = L.layerGroup().addTo(this.map);

    // Event delegation: un solo listener sul container per tutti i popup buttons
    this.clickListener = (e: MouseEvent) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('.tq-popup-btn');
      if (btn?.dataset['questId']) {
        this.questSelected.emit(btn.dataset['questId']);
      }
    };
    this.map.getContainer().addEventListener('click', this.clickListener);

    this.renderMarkers();
  }

  private renderMarkers(): void {
    this.markersLayer.clearLayers();

    for (const quest of this.quests) {
      if (!quest.location?.lat || !quest.location?.lng) continue;

      const isSelected = quest.id === this.selectedQuestId;
      const isInactive = quest.status !== QuestStatus.ACTIVE;
      const variant = isInactive
        ? 'inactive'
        : quest.type === QuestType.PRIMARY
          ? 'primary'
          : 'secondary';

      const icon = createCustomMarker(variant);

      const marker = L.marker([quest.location.lat, quest.location.lng], { icon });

      if (this.interactive) {
        const popupHtml = this.buildPopupHtml(quest, isSelected);
        marker.bindPopup(popupHtml, {
          className: 'tq-leaflet-popup',
          maxWidth: 240,
          offset: [0, -15],
        });
      }

      this.markersLayer.addLayer(marker);
    }
  }

  private buildPopupHtml(quest: AnyQuest, isSelected: boolean): string {
    const typeLabel = quest.type === QuestType.PRIMARY ? '★ Principale' : '● Secondaria';
    const statusLabel = quest.status === QuestStatus.ACTIVE ? 'Attiva' : 'Inattiva';
    const statusColor = quest.status === QuestStatus.ACTIVE ? '#1a5c38' : '#9a8f7e';

    let collectibleHtml = '';
    if (quest.type === QuestType.PRIMARY) {
      const primaryQuest = quest as PrimaryQuest;
      const cid = primaryQuest.collectibleId;
      if (cid) {
        const name = this.collectiblesById[cid] ?? '';
        const imgUrl = this.collectibleImageById[cid] ?? '';
        if (name) {
          const imgTag = imgUrl
            ? `<img src="${escapeHtml(imgUrl)}" style="width:30px;height:30px;border-radius:6px;object-fit:cover;flex-shrink:0;border:1px solid #e8e2d8" onerror="this.style.display='none'">`
            : '';
          collectibleHtml = `
            <div style="display:flex;align-items:center;gap:8px;padding:6px 8px;background:#f7f4ef;border-radius:6px;margin-bottom:10px">
              ${imgTag}
              <div>
                <div style="font-size:12px;font-weight:500;color:#1a1a14">${escapeHtml(name)}</div>
                <div style="font-size:10.5px;color:#a06010;font-weight:500;margin-top:1px">★ Collezionabile</div>
              </div>
            </div>`;
        }
      }
    }

    return `
      <div style="font-family:'DM Sans',system-ui,sans-serif;min-width:200px">
        <div style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:20px;
                    background:#edf5f0;color:#1a5c38;font-size:10.5px;font-weight:600;margin-bottom:6px">
          ${escapeHtml(typeLabel)}
        </div>
        <div style="font-size:13.5px;font-weight:700;color:#1a1a14;margin-bottom:2px;letter-spacing:-0.01em">
          ${escapeHtml(quest.name ?? '')}
        </div>
        <div style="font-size:11.5px;color:#6b6452;margin-bottom:8px">
          ${escapeHtml(quest.location?.address ?? '')}
        </div>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
          <span style="font-size:12px;font-weight:600;color:#a06010;display:flex;align-items:center;gap:3px">
            ★ ${quest.points ?? 0} pt
          </span>
          <span style="padding:2px 8px;border-radius:20px;font-size:11px;font-weight:500;
                       background:#edf5f0;color:${escapeHtml(statusColor)}">
            ${escapeHtml(statusLabel)}
          </span>
        </div>
        ${collectibleHtml}
        <button
          class="tq-popup-btn"
          data-quest-id="${escapeHtml(quest.id)}"
          style="width:100%;background:#1a5c38;color:#fff;border:none;border-radius:6px;
                 padding:7px 12px;font-size:12.5px;font-weight:500;cursor:pointer;
                 display:flex;align-items:center;justify-content:center;gap:6px;
                 font-family:'DM Sans',system-ui,sans-serif"
        >
          Modifica quest →
        </button>
      </div>`;
  }
}
