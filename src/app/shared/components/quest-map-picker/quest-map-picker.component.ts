import {
  AfterViewInit,
  Component,
  ElementRef,
  forwardRef,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import * as L from 'leaflet';
import {
  applyLeafletIconFix,
  createOsmTileLayer,
  TRENTINO_CENTER,
  TRENTINO_ZOOM,
  QUEST_ZOOM,
} from '../../leaflet/leaflet-config';

applyLeafletIconFix();

/**
 * Marker custom Terrain B (verde): un dot centrato, ancorato al proprio
 * centro così da coincidere esattamente col centro del cerchio del raggio.
 */
function createPickerMarker(): L.DivIcon {
  const html = `
    <div style="width:14px;height:14px;border-radius:50%;background:#1a5c38;border:2.5px solid #fff;
                box-shadow:0 1px 5px rgba(0,0,0,0.35)"></div>`;
  return L.divIcon({ html, className: '', iconSize: [14, 14], iconAnchor: [7, 7] });
}

/**
 * Valore gestito dal form control: punto geografico + raggio.
 */
export interface MapPickerValue {
  lat: number;
  lng: number;
  radius: number;
}

/**
 * Componente mappa picker per selezionare posizione e raggio di una
 * quest.
 *
 * Espone se' stesso come ControlValueAccessor: puo' essere usato
 * direttamente in un Reactive Form con formControlName, ricevendo
 * un MapPickerValue. Il componente emette il nuovo valore ogni
 * volta che l'utente clicca sulla mappa per (ri)posizionare il
 * marker o modifica il raggio tramite l'input numerico esterno.
 *
 * Il raggio viene ricevuto come input separato (@Input radius) per
 * permettere alla pagina contenitore di sincronizzare uno slider /
 * input numerico esterno. Il valore emesso include sempre il raggio
 * corrente cosi' il form ha sempre uno stato consistente.
 */
@Component({
  selector: 'app-quest-map-picker',
  standalone: true,
  imports: [CommonModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => QuestMapPickerComponent),
      multi: true,
    },
  ],
  template: `
    <div #mapContainer class="map-container"></div>
    @if (!hasPosition) {
      <p class="hint">Clicca sulla mappa per posizionare il punto.</p>
    }
  `,
  styles: [
    `
      :host {
        display: block;
        position: relative;
        height: 100%;
        min-height: 320px;
      }
      .map-container {
        width: 100%;
        height: 100%;
      }
      .hint {
        position: absolute;
        left: 50%;
        bottom: 16px;
        transform: translateX(-50%);
        z-index: 500;
        margin: 0;
        padding: 6px 14px;
        font-size: 12.5px;
        color: var(--tq-text-muted);
        background: var(--tq-surface);
        border: 1px solid var(--tq-border);
        border-radius: 20px;
        box-shadow: var(--tq-shadow-sm);
        white-space: nowrap;
      }
    `,
  ],
})
export class QuestMapPickerComponent
  implements AfterViewInit, OnChanges, OnDestroy, ControlValueAccessor
{
  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef<HTMLDivElement>;

  /**
   * Raggio in metri da disegnare attorno al marker. Ricevuto come input
   * separato cosi' la pagina puo' avere un controllo numerico esterno
   * (slider o input) che lo modifica indipendentemente dal click sulla
   * mappa.
   */
  @Input() radius = 100;

  private map?: L.Map;
  private marker?: L.Marker;
  private circle?: L.Circle;
  private value: MapPickerValue | null = null;

  private onChange: (value: MapPickerValue | null) => void = () => {
    /* placeholder fino al registerOnChange */
  };
  private onTouched: () => void = () => {
    /* placeholder fino al registerOnTouched */
  };

  get hasPosition(): boolean {
    return this.value !== null;
  }

  ngAfterViewInit(): void {
    this.initMap();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['radius'] && this.circle && this.value) {
      this.circle.setRadius(this.radius);
      // Aggiorna il valore emesso con il nuovo raggio
      this.value = { ...this.value, radius: this.radius };
      this.onChange(this.value);
    }
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
    }
  }

  /**
   * Inizializza la mappa Leaflet con tile OpenStreetMap.
   *
   * Se il componente ha gia' ricevuto un valore via writeValue (caso
   * della modifica di una quest esistente), centra subito la mappa
   * sulla posizione esistente e aggiunge il marker. Altrimenti centra
   * sul Trentino.
   */
  private initMap(): void {
    const initialCenter: L.LatLngTuple = this.value
      ? [this.value.lat, this.value.lng]
      : TRENTINO_CENTER;
    const initialZoom = this.value ? QUEST_ZOOM : TRENTINO_ZOOM;

    this.map = L.map(this.mapContainer.nativeElement).setView(initialCenter, initialZoom);
    createOsmTileLayer().addTo(this.map);

    this.map.on('click', (event: L.LeafletMouseEvent) => {
      this.setMarker(event.latlng.lat, event.latlng.lng);
      this.onTouched();
    });

    // Se gia' c'e' un valore, posiziona subito marker e cerchio
    if (this.value) {
      this.drawMarkerAndCircle(this.value.lat, this.value.lng);
    }
  }

  /**
   * Setta o aggiorna la posizione del marker sulla mappa e emette il
   * cambiamento di valore al form.
   */
  private setMarker(lat: number, lng: number): void {
    this.drawMarkerAndCircle(lat, lng);
    this.value = { lat, lng, radius: this.radius };
    this.onChange(this.value);
  }

  /**
   * Disegna (o ridisegna) marker e cerchio del raggio alla posizione
   * specificata. Estratto da setMarker per essere riutilizzato anche
   * in initMap quando il componente parte gia' con un valore.
   */
  private drawMarkerAndCircle(lat: number, lng: number): void {
    if (!this.map) {
      return;
    }
    const isFirstPlacement = !this.marker;

    if (this.marker) {
      this.marker.setLatLng([lat, lng]);
    } else {
      this.marker = L.marker([lat, lng], { icon: createPickerMarker() }).addTo(this.map);
    }
    if (this.circle) {
      this.circle.setLatLng([lat, lng]).setRadius(this.radius);
    } else {
      this.circle = L.circle([lat, lng], {
        radius: this.radius,
        color: '#1a5c38',
        fillColor: '#1a5c38',
        fillOpacity: 0.12,
        weight: 2,
        dashArray: '5 5',
      }).addTo(this.map);
    }

    if (isFirstPlacement) {
      this.centerOnMarker();
    }
  }

  /**
   * Centra la mappa sulla posizione del marker corrente con una zoom
   * fissa adatta al contesto di una quest (livello strada visibile).
   *
   * Chiamato solo al primo posizionamento del marker: gli aggiornamenti
   * successivi (sposta marker, cambia raggio) rispettano la vista
   * corrente dell'utente.
   */
  private centerOnMarker(): void {
    if (!this.map || !this.marker) {
      return;
    }
    this.map.setView(this.marker.getLatLng(), QUEST_ZOOM, { animate: true });
  }

  // ===== ControlValueAccessor =====

  writeValue(value: MapPickerValue | null): void {
    this.value = value;
    if (value && this.map) {
      this.drawMarkerAndCircle(value.lat, value.lng);
    }
  }

  registerOnChange(fn: (value: MapPickerValue | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState?(): void {
    // Non implementato: la mappa rimane sempre interagibile.
    // Potrebbe essere esteso disabilitando i click in lettura.
  }
}
