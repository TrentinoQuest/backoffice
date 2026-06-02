import * as L from 'leaflet';

/**
 * Coordinate del centro geografico del Trentino, usate come default
 * quando una mappa viene inizializzata senza un valore preesistente.
 */
export const TRENTINO_CENTER: L.LatLngTuple = [46.0667, 11.1167];

/**
 * Livello di zoom per inquadrare l'intera regione Trentino.
 */
export const TRENTINO_ZOOM = 9;

/**
 * Livello di zoom per inquadrare una singola quest (livello strada).
 */
export const QUEST_ZOOM = 18;

/**
 * Applica il fix per il bug noto di Leaflet con bundler come webpack
 * e vite: i path relativi delle icone marker di default non vengono
 * risolti correttamente. Settiamo gli URL espliciti agli asset CDN.
 *
 * Va chiamato una sola volta a livello applicazione. Multiple
 * invocazioni sono idempotenti.
 *
 * Riferimento: https://github.com/Leaflet/Leaflet/issues/4968
 */
export function applyLeafletIconFix(): void {
  delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: () => string })._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  });
}

/**
 * Crea un layer di tile OpenStreetMap pronto per essere aggiunto a una
 * mappa. Centralizzato qui per non duplicare l'attribution e i
 * parametri di zoom max in piu' componenti.
 */
export function createOsmTileLayer(): L.TileLayer {
  return L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  });
}
