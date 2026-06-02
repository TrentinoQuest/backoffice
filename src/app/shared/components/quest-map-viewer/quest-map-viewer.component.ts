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

/** Crea un marker Leaflet custom con lo stile Terrain B (pin a goccia). */
function createCustomMarker(
  variant: 'primary' | 'secondary' | 'inactive',
  selected = false,
): L.DivIcon {
  const colors: Record<typeof variant, string> = {
    primary: '#1a5c38',
    secondary: '#a06010',
    inactive: '#9a8f7e',
  };
  const color = colors[variant];
  const opacity = variant === 'inactive' ? '0.6' : '1';
  // Dot + stem (lo stile originale, più pulito), con dimensione maggiore
  // e alone se selezionato.
  const dot = selected ? 16 : 13;
  const ring = selected
    ? `box-shadow:0 0 0 6px rgba(26,92,56,0.18),0 2px 6px rgba(0,0,0,0.3);`
    : `box-shadow:0 2px 6px rgba(0,0,0,0.28);`;
  const stem = 8;
  const shadow = 3;
  const w = dot; // larghezza del box = diametro del dot
  const h = dot + stem + shadow + 1; // altezza totale del pin
  // NB: nessun transform interno. Il posizionamento sul punto è gestito
  // interamente da iconAnchor (punta in basso al centro), così il pin
  // visivo coincide esattamente con la coordinata della quest.
  const html = `
    <div style="display:flex;flex-direction:column;align-items:center;opacity:${opacity}">
      <div style="width:${dot}px;height:${dot}px;border-radius:50%;background:${color};
                  border:3px solid #fff;${ring}"></div>
      <div style="width:2px;height:${stem}px;background:#fff;opacity:0.75"></div>
      <div style="width:9px;height:${shadow}px;border-radius:50%;background:rgba(0,0,0,0.2);margin-top:1px"></div>
    </div>`;
  return L.divIcon({ html, className: '', iconSize: [w, h], iconAnchor: [w / 2, h] });
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

  /** Emesso dal bottone "Modifica quest" nel popup: naviga al form. */
  @Output() questSelected = new EventEmitter<string>();
  /** Emesso cliccando un marker: seleziona la quest (senza navigare). */
  @Output() questFocused = new EventEmitter<string>();

  /** Zoom usato quando si centra su una singola quest. */
  private readonly FOCUS_ZOOM = 15;

  private map!: L.Map;
  private markersLayer!: L.LayerGroup;
  private clickListener?: (e: MouseEvent) => void;
  /** Marker per id quest, per aprire il popup quando si centra sulla quest. */
  private readonly markersById = new Map<string, L.Marker>();

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
    // Quando cambia la quest selezionata (es. click nella lista), centra
    // e zooma la mappa su di essa con un'animazione fluida.
    if (changes['selectedQuestId'] && this.selectedQuestId) {
      this.focusOnQuest(this.selectedQuestId);
    }
    if (changes['centerOn'] && this.centerOn) {
      this.map.setView([this.centerOn.lat, this.centerOn.lng], 14);
    }
  }

  /** Centra e zooma la mappa sulla quest indicata e apre il suo popup. */
  private focusOnQuest(questId: string): void {
    const quest = this.quests.find((q) => q.id === questId);
    if (!quest) return;
    const geo = quest.type === QuestType.PRIMARY ? quest.searchArea : quest.position;
    if (!geo) return;
    this.map.flyTo([geo.lat, geo.lng], Math.max(this.map.getZoom(), this.FOCUS_ZOOM), {
      duration: 0.6,
    });
    // Apri il popup a fine animazione, una sola volta.
    const marker = this.markersById.get(questId);
    if (marker && this.interactive) {
      this.map.once('moveend', () => marker.openPopup());
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
    this.markersById.clear();

    for (const quest of this.quests) {
      const geo = quest.type === QuestType.PRIMARY ? quest.searchArea : quest.position;
      if (!geo) continue;

      const isSelected = quest.id === this.selectedQuestId;
      const isInactive = quest.status !== QuestStatus.ACTIVE;
      const variant = isInactive
        ? 'inactive'
        : quest.type === QuestType.PRIMARY
          ? 'primary'
          : 'secondary';

      const icon = createCustomMarker(variant, isSelected);

      // Altezza totale del pin: dot + stem(8) + shadow(3) + 1, coerente con
      // createCustomMarker, per offsettare il popup sopra la punta.
      const dot = isSelected ? 16 : 13;
      const markerHeight = dot + 8 + 3 + 1;
      const marker = L.marker([geo.lat, geo.lng], { icon, zIndexOffset: isSelected ? 1000 : 0 });

      if (this.interactive) {
        const popupHtml = this.buildPopupHtml(quest);
        marker.bindPopup(popupHtml, {
          className: 'tq-leaflet-popup',
          maxWidth: 240,
          // Offset verso l'alto pari all'altezza del marker, così il popup
          // sta sopra il pin e non lo copre.
          offset: [0, -markerHeight],
        });
        // Cliccare il marker seleziona la quest (evidenzia nella lista e zooma).
        marker.on('click', () => this.questFocused.emit(quest.id));
      }

      this.markersById.set(quest.id, marker);
      this.markersLayer.addLayer(marker);
    }
  }

  private buildPopupHtml(quest: AnyQuest): string {
    const typeLabel = quest.type === QuestType.PRIMARY ? '★ Principale' : '● Secondaria';
    const statusLabel = quest.status === QuestStatus.ACTIVE ? 'Attiva' : 'Inattiva';
    // Usa i token CSS del design system: il popup è stilizzato anche via
    // .tq-leaflet-popup in styles.css, così resta leggibile in dark mode.
    const statusColor =
      quest.status === QuestStatus.ACTIVE ? 'var(--tq-primary)' : 'var(--tq-text-subtle)';

    let collectibleHtml = '';
    if (quest.type === QuestType.PRIMARY) {
      const primaryQuest = quest as PrimaryQuest;
      const cid = primaryQuest.collectibleId;
      if (cid) {
        const name = this.collectiblesById[cid] ?? '';
        const imgUrl = this.collectibleImageById[cid] ?? '';
        if (name) {
          const imgTag = imgUrl
            ? `<img src="${escapeHtml(imgUrl)}" style="width:30px;height:30px;border-radius:6px;object-fit:cover;flex-shrink:0;border:1px solid var(--tq-border)" onerror="this.style.display='none'">`
            : '';
          collectibleHtml = `
            <div style="display:flex;align-items:center;gap:8px;padding:6px 8px;background:var(--tq-surface-alt);border-radius:6px;margin-bottom:10px">
              ${imgTag}
              <div>
                <div style="font-size:12px;font-weight:500;color:var(--tq-text)">${escapeHtml(name)}</div>
                <div style="font-size:10.5px;color:var(--tq-amber);font-weight:500;margin-top:1px">★ Collezionabile</div>
              </div>
            </div>`;
        }
      }
    }

    return `
      <div style="font-family:var(--tq-font-body);min-width:200px">
        <div style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:20px;
                    background:var(--tq-primary-light);color:var(--tq-primary);font-size:10.5px;font-weight:600;margin-bottom:6px">
          ${escapeHtml(typeLabel)}
        </div>
        <div style="font-size:13.5px;font-weight:700;color:var(--tq-text);margin-bottom:8px;letter-spacing:-0.01em">
          ${escapeHtml(quest.name ?? '')}
        </div>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
          <span style="font-size:12px;font-weight:600;color:var(--tq-amber);display:flex;align-items:center;gap:3px">
            ★ ${quest.basePoints ?? 0} pt
          </span>
          <span style="padding:2px 8px;border-radius:20px;font-size:11px;font-weight:500;
                       background:var(--tq-surface-alt);color:${statusColor}">
            ${escapeHtml(statusLabel)}
          </span>
        </div>
        ${collectibleHtml}
        <button
          class="tq-popup-btn"
          data-quest-id="${escapeHtml(quest.id)}"
          style="width:100%;background:var(--tq-primary);color:#fff;border:none;border-radius:6px;
                 padding:7px 12px;font-size:12.5px;font-weight:500;cursor:pointer;
                 display:flex;align-items:center;justify-content:center;gap:6px;
                 font-family:var(--tq-font-body)"
        >
          Modifica quest →
        </button>
      </div>`;
  }
}
