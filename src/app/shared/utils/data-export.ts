/**
 * Utility per l'esportazione di dataset tabellari verso file scaricabili.
 *
 * Tutto avviene lato client (nessuna chiamata al backend): i dati gia'
 * caricati nelle pagine analytics vengono serializzati in CSV o JSON e
 * offerti al download tramite un blob temporaneo. Usato dalla pagina
 * Analytics per rendere esportabili tabelle, serie storiche e cluster.
 */

/** Singola colonna di un export CSV: chiave nel record + intestazione leggibile. */
export interface CsvColumn<T> {
  header: string;
  /** Valore della cella; puo' essere derivato dal record. */
  value: (row: T) => string | number | null | undefined;
}

/** Forza la virgola tra cella e cella, citando i valori che lo richiedono. */
function escapeCsvCell(raw: string | number | null | undefined): string {
  const s = raw === null || raw === undefined ? '' : String(raw);
  if (/[",\n;]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Avvia il download di un blob con il nome file indicato. */
function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Rilascia l'URL dopo che il browser ha avviato il download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Serializza un array di record in CSV e ne avvia il download.
 *
 * Antepone il BOM UTF-8 cosi' che Excel apra correttamente gli accenti.
 */
export function downloadCsv<T>(
  filename: string,
  columns: CsvColumn<T>[],
  rows: readonly T[],
): void {
  const headerLine = columns.map((c) => escapeCsvCell(c.header)).join(',');
  const dataLines = rows.map((row) => columns.map((c) => escapeCsvCell(c.value(row))).join(','));
  const csv = '﻿' + [headerLine, ...dataLines].join('\r\n');
  triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), filename);
}

/** Serializza un oggetto qualsiasi in JSON indentato e ne avvia il download. */
export function downloadJson(filename: string, data: unknown): void {
  const json = JSON.stringify(data, null, 2);
  triggerDownload(new Blob([json], { type: 'application/json;charset=utf-8;' }), filename);
}

/** Suffisso data (YYYY-MM-DD) per nomi file di export riproducibili. */
export function exportDateStamp(date: Date = new Date()): string {
  return date.toISOString().split('T')[0];
}
