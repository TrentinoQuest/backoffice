import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import type { AnyQuest } from '@trentino-quest/shared-types';
import { QuestStatus, QuestType } from '@trentino-quest/shared-types';
import { QuestsAdminService } from '../../../core/services/quests-admin.service';
import { QuestMapViewerComponent } from '../../../shared/components/quest-map-viewer/quest-map-viewer.component';

/**
 * Pagina di panoramica geografica delle quest.
 *
 * Mostra una mappa del Trentino con un marker per ogni quest del
 * sistema, filtrabile per tipo e status. L'admin puo' cliccare un
 * marker per navigare al form di modifica della relativa quest.
 *
 * Coperto dal requisito RF36 del Deliverable D1: visualizzazione
 * della mappa d'insieme con posizione e stato di ogni quest.
 */
@Component({
  selector: 'app-admin-quests-map',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatSelectModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    QuestMapViewerComponent,
  ],
  templateUrl: './admin-quests-map.page.html',
  styleUrl: './admin-quests-map.page.scss',
})
export class AdminQuestsMapPage implements OnInit {
  private readonly questsService = inject(QuestsAdminService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);

  readonly typeOptions: { value: QuestType | null; label: string }[] = [
    { value: null, label: 'Tutti i tipi' },
    { value: QuestType.PRIMARY, label: 'Principali' },
    { value: QuestType.SECONDARY, label: 'Secondarie' },
  ];

  readonly statusOptions: { value: QuestStatus | null; label: string }[] = [
    { value: null, label: 'Tutti gli stati' },
    { value: QuestStatus.ACTIVE, label: 'Attive' },
    { value: QuestStatus.INACTIVE, label: 'Inattive' },
    { value: QuestStatus.ARCHIVED, label: 'Archiviate' },
  ];

  readonly typeFilter = signal<QuestType | null>(null);
  readonly statusFilter = signal<QuestStatus | null>(null);

  readonly quests = signal<AnyQuest[]>([]);
  readonly isLoading = signal(false);

  ngOnInit(): void {
    void this.loadQuests();
  }

  /**
   * Carica tutte le quest dal backend in base ai filtri correnti.
   *
   * Pagina implicitamente le richieste al backend in batch da 100
   * (limite massimo accettato dall'API). Per dataset di centinaia
   * di quest fa qualche chiamata sequenziale; per dataset piu'
   * grandi (migliaia) sara' necessario implementare clustering
   * dei marker o caricamento per bounding box.
   */
  async loadQuests(): Promise<void> {
    this.isLoading.set(true);
    try {
      const all: AnyQuest[] = [];
      const pageSize = 100;
      let offset = 0;
      let total = 0;

      do {
        const response = await this.questsService.list({
          type: this.typeFilter() ?? undefined,
          status: this.statusFilter() ?? undefined,
          limit: pageSize,
          offset,
        });
        all.push(...response.data);
        total = response.total;
        offset += pageSize;
      } while (offset < total);

      this.quests.set(all);
    } catch (err) {
      this.showError('Errore nel caricamento delle quest', err);
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Reagisce al cambio di filtro: ricarica le quest dal backend con
   * i nuovi parametri.
   */
  onFilterChange(): void {
    void this.loadQuests();
  }

  /**
   * Handler dell'evento questSelected del map viewer: naviga al form
   * di modifica della quest cliccata.
   */
  onQuestSelected(questId: string): void {
    void this.router.navigateByUrl(`/admin/quests/${questId}/edit`);
  }

  private showError(prefix: string, err: unknown): void {
    let detail = 'Errore sconosciuto';
    if (err instanceof HttpErrorResponse) {
      detail = (err.error as { message?: string })?.message ?? `HTTP ${err.status}`;
    }
    this.snackBar.open(`${prefix}: ${detail}`, 'Chiudi', { duration: 5000 });
  }
}
