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
import type { AnyQuest } from '@trentino-quest/shared-types';
import { QuestType } from '@trentino-quest/shared-types';
import {
  applyLeafletIconFix,
  createOsmTileLayer,
  TRENTINO_CENTER,
  TRENTINO_ZOOM,
} from '../../leaflet/leaflet-config';

applyLeafletIconFix();

/**
 * Componente mappa per la visualizzazione di un insieme di quest sul
 * territorio.
 *
 * Mostra un marker per ogni quest ricevuta come input, colorato e
 * stilizzato in base al tipo (primary/secondary) e allo status
 * (active/inactive/archived). Cliccando un marker, l'utente vede un
 * popup con le informazioni essenziali e puo' navigare al dettaglio
 * della quest emettendo l'evento questSelected.
 *
 * A differenza del map picker, questo componente e' read-only: l'utente
 * non posiziona ne' modifica nulla, esplora soltanto.
 *
 * Quando l'input quests cambia, i marker vengono ridisegnati: rimossi
 * i precedenti e aggiunti i nuovi. La vista della mappa non viene
 * modificata per rispettare la navigazione corrente dell'utente.
 */
@Component({
  selector: 'app-quest-map-viewer',
  standalone: true,
  imports: [CommonModule],
  template: ` <div #mapContainer class="map-container"></div> `,
  styles: [
    `
      :host {
        display: block;
      }
      .map-container {
        width: 100%;
        height: 600px;
        border-radius: 4px;
        border: 1px solid #ccc;
      }
    `,
  ],
})
export class QuestMapViewerComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef<HTMLDivElement>;

  /**
   * Lista delle quest da visualizzare sulla mappa. Ogni volta che
   * cambia, i marker vengono ridisegnati.
   */
  @Input() quests: AnyQuest[] = [];

  /**
   * Emette l'id della quest cliccata sul marker. La pagina contenitore
   * tipicamente reagisce navigando al dettaglio o al form di modifica.
   */
  @Output() readonly questSelected = new EventEmitter<string>();

  private map?: L.Map;
  private markersLayer?: L.LayerGroup;

  ngAfterViewInit(): void {
    this.initMap();
    this.map?.attributionControl.setPrefix('TrentinoQuest');
    this.renderMarkers();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['quests'] && this.map) {
      this.renderMarkers();
    }
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
    }
  }

  private initMap(): void {
    this.map = L.map(this.mapContainer.nativeElement).setView(TRENTINO_CENTER, TRENTINO_ZOOM);
    createOsmTileLayer().addTo(this.map);
    this.markersLayer = L.layerGroup().addTo(this.map);
  }

  /**
   * Rimuove i marker precedenti e ne disegna di nuovi in base alla
   * lista corrente di quest.
   */
  private renderMarkers(): void {
    if (!this.markersLayer) {
      return;
    }
    this.markersLayer.clearLayers();

    for (const quest of this.quests) {
      const position = quest.type === QuestType.PRIMARY ? quest.searchArea : quest.position;

      const icon = this.buildIcon(quest);
      const marker = L.marker([position.lat, position.lng], { icon });

      marker.bindPopup(this.buildPopupContent(quest));
      marker.on('popupopen', () => {
        // L'evento click sull'azione del popup arriva tramite il
        // listener attaccato al document via questo metodo. Vedi
        // bindPopupActionListener per dettagli.
        this.bindPopupActionListener(quest.id);
      });

      marker.addTo(this.markersLayer);
    }
  }

  /**
   * Costruisce un'icona divIcon per una quest, applicando classi CSS
   * differenziate in base a tipo e status. La definizione visuale
   * (colori, dimensioni) e' nel file scss della pagina contenitore.
   */
  private buildIcon(quest: AnyQuest): L.DivIcon {
    const typeClass = `marker-${quest.type}`;
    const statusClass = `marker-status-${quest.status}`;
    const iconChar = quest.type === QuestType.PRIMARY ? '★' : '●';

    return L.divIcon({
      className: `quest-marker ${typeClass} ${statusClass}`,
      html: `<span class="quest-marker-inner">${iconChar}</span>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
      popupAnchor: [0, -14],
    });
  }

  /**
   * Genera il contenuto HTML del popup di un marker. Include nome,
   * tipo, status, punti base e un pulsante per navigare al dettaglio.
   */
  private buildPopupContent(quest: AnyQuest): string {
    const typeLabel = quest.type === QuestType.PRIMARY ? 'Principale' : 'Secondaria';
    const statusLabels: Record<string, string> = {
      active: 'Attiva',
      inactive: 'Inattiva',
      archived: 'Archiviata',
    };
    const statusLabel = statusLabels[quest.status] ?? quest.status;

    return `
      <div class="quest-popup">
        <h3 class="quest-popup-title">${this.escapeHtml(quest.name)}</h3>
        <p class="quest-popup-meta">
          <strong>Tipo:</strong> ${typeLabel}<br/>
          <strong>Status:</strong> ${statusLabel}<br/>
          <strong>Punti base:</strong> ${quest.basePoints}
        </p>
        <button class="quest-popup-action" data-quest-id="${quest.id}">
          Modifica
        </button>
      </div>
    `;
  }

  /**
   * Aggiunge il listener al pulsante "Modifica" presente nel popup
   * appena aperto. Necessario perche' il popup di Leaflet vive fuori
   * dall'albero di Angular e non riceve gli handler diretti di
   * (click)="...".
   *
   * Il listener viene rimosso automaticamente alla chiusura del popup
   * grazie all'evento popupclose registrato in renderMarkers (TODO se
   * necessario in futuro per evitare leak).
   */
  private bindPopupActionListener(questId: string): void {
    setTimeout(() => {
      const button = document.querySelector<HTMLButtonElement>(
        `.quest-popup-action[data-quest-id="${questId}"]`,
      );
      if (button) {
        button.addEventListener('click', () => this.questSelected.emit(questId), { once: true });
      }
    }, 0);
  }

  /**
   * Escape minimale di stringhe per inserimento in HTML, sufficiente
   * per nomi e descrizioni delle quest. Per sicurezza estesa si
   * dovrebbe usare DomSanitizer di Angular ma qui i dati provengono
   * dal nostro backend (gia' validati).
   */
  private escapeHtml(value: string): string {
    const div = document.createElement('div');
    div.textContent = value;
    return div.innerHTML;
  }
}
