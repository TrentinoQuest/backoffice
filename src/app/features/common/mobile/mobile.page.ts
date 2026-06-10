import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

/**
 * URL della cartella Google Drive contenente i file di configurazione
 * Firebase (.plist) e le relative istruzioni per l'app mobile.
 */
const DRIVE_URL =
  'https://drive.google.com/drive/folders/1DTrJKauvpOCAH2peCpUUhc6cPACjB1oQ?usp=sharing';

/**
 * Pagina /mobile.
 *
 * Reindirizza automaticamente alla cartella Google Drive con i file
 * Firebase e le istruzioni. Mostra anche un link manuale come fallback
 * nel caso il redirect automatico venga bloccato dal browser.
 */
@Component({
  selector: 'app-mobile-page',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatProgressSpinnerModule],
  templateUrl: './mobile.page.html',
  styleUrl: './mobile.page.scss',
})
export class MobilePage implements OnInit {
  /** Esposto al template per il link di fallback. */
  readonly driveUrl = DRIVE_URL;

  /**
   * Esegue il redirect alla cartella Drive non appena la pagina si carica.
   */
  ngOnInit(): void {
    window.location.href = DRIVE_URL;
  }
}
