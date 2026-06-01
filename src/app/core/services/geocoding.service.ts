import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface GeocodingResult {
  displayName: string;
  lat: number;
  lon: number;
}

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
}

interface NominatimReverseResult {
  display_name?: string;
  address?: {
    road?: string;
    pedestrian?: string;
    footway?: string;
    house_number?: string;
    city?: string;
    town?: string;
    village?: string;
    hamlet?: string;
    municipality?: string;
  };
}

// Bounding box of Trentino-Alto Adige: west, north, east, south
const TRENTINO_VIEWBOX = '10.4,47.1,12.5,45.6';

@Injectable({ providedIn: 'root' })
export class GeocodingService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'https://nominatim.openstreetmap.org/search';
  private readonly reverseUrl = 'https://nominatim.openstreetmap.org/reverse';

  /** Cache delle reverse-geocode già risolte, chiave "lat,lng" arrotondata. */
  private readonly reverseCache = new Map<string, string>();

  async search(query: string): Promise<GeocodingResult[]> {
    if (!query.trim()) {
      return [];
    }
    const params = new HttpParams()
      .set('q', query)
      .set('format', 'json')
      .set('limit', '5')
      .set('viewbox', TRENTINO_VIEWBOX)
      .set('bounded', '1')
      .set('accept-language', 'it');

    const results = await firstValueFrom(
      this.http.get<NominatimResult[]>(this.baseUrl, { params }),
    );

    return results.map((r) => ({
      displayName: r.display_name,
      lat: parseFloat(r.lat),
      lon: parseFloat(r.lon),
    }));
  }

  /**
   * Reverse geocoding: dato un punto, restituisce un'etichetta leggibile
   * del luogo (es. "Via Roma, Trento"). Il risultato è cachato in memoria
   * per evitare richieste ripetute alla stessa posizione. In caso di
   * errore restituisce le coordinate formattate come fallback.
   */
  async reverse(lat: number, lng: number): Promise<string> {
    const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    const cached = this.reverseCache.get(key);
    if (cached !== undefined) {
      return cached;
    }

    const fallback = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    try {
      const params = new HttpParams()
        .set('lat', String(lat))
        .set('lon', String(lng))
        .set('format', 'json')
        .set('zoom', '16')
        .set('accept-language', 'it');

      const res = await firstValueFrom(
        this.http.get<NominatimReverseResult>(this.reverseUrl, { params }),
      );

      const label = this.formatReverse(res) || fallback;
      this.reverseCache.set(key, label);
      return label;
    } catch {
      this.reverseCache.set(key, fallback);
      return fallback;
    }
  }

  private formatReverse(res: NominatimReverseResult): string {
    const a = res.address;
    if (!a) {
      return res.display_name ?? '';
    }
    const street = a.road ?? a.pedestrian ?? a.footway ?? '';
    const streetWithNumber =
      street && a.house_number ? `${street} ${a.house_number}` : street;
    const city = a.city ?? a.town ?? a.village ?? a.hamlet ?? a.municipality ?? '';
    const parts = [streetWithNumber, city].filter((p) => p.length > 0);
    return parts.join(', ');
  }
}
