import { Component, computed, inject, signal, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule, DatePipe, TitleCasePipe } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AnyQuest, QuestStatus, QuestType } from '@trentino-quest/shared-types';
import { QuestsAdminService } from '../../../core/services/quests-admin.service';

/**
 * Pagina amministrativa per la gestione delle quest.
 *
 * Mostra una tabella paginata di tutte le quest del sistema, con
 * filtri per tipo e status. Per ogni quest sono disponibili azioni
 * contestuali (attiva/disattiva/archivia) coerenti con il suo stato
 * corrente. La creazione e la modifica avvengono in pagine dedicate.
 */
@Component({
  selector: 'app-admin-quests',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DatePipe,
    TitleCasePipe,
    MatCardModule,
    MatTableModule,
    MatPaginatorModule,
    MatFormFieldModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatTooltipModule,
  ],
  templateUrl: './admin-quests.page.html',
  styleUrl: './admin-quests.page.scss',
})
export class AdminQuestsPage implements AfterViewInit {
  private readonly questsService = inject(QuestsAdminService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);

  /**
   * Riferimento al paginator nel template, necessario per leggerne lo
   * stato corrente (pageIndex, pageSize) quando ricarichiamo i dati.
   */
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  /**
   * Colonne mostrate dalla MatTable. L'ordine determina la sequenza
   * delle colonne nell'header e nelle righe.
   */
  readonly displayedColumns = ['name', 'type', 'status', 'basePoints', 'createdAt', 'actions'];

  /**
   * Opzioni per i filtri. Espongono le enum di shared-types come
   * array per iterazione nel template.
   */
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

  /**
   * Stato corrente dei filtri. Nullable per indicare "nessun filtro".
   */
  readonly typeFilter = signal<QuestType | null>(null);
  readonly statusFilter = signal<QuestStatus | null>(null);

  /**
   * Lista delle quest e contatori per la paginazione.
   */
  readonly quests = signal<AnyQuest[]>([]);
  readonly totalCount = signal(0);
  readonly isLoading = signal(false);

  /**
   * Computed che espone gli enum a template senza dovere fare
   * comparazioni manuali con stringhe.
   */
  readonly QuestType = QuestType;
  readonly QuestStatus = QuestStatus;

  /**
   * Helper visivi per status e tipo: ritorna una classe CSS in base
   * al valore. Usati per colorare i badge nella tabella.
   */
  statusClass = computed(
    () =>
      (status: QuestStatus): string =>
        `badge badge-${status}`,
  );
  typeClass = computed(
    () =>
      (type: QuestType): string =>
        `badge badge-${type}`,
  );

  ngAfterViewInit(): void {
    this.loadQuests();
  }

  /**
   * Carica le quest dal backend usando i filtri correnti e lo stato
   * del paginator. In caso di errore mostra una snackbar.
   */
  async loadQuests(): Promise<void> {
    this.isLoading.set(true);
    try {
      const limit = this.paginator?.pageSize ?? 20;
      const offset = (this.paginator?.pageIndex ?? 0) * limit;

      const response = await this.questsService.list({
        type: this.typeFilter() ?? undefined,
        status: this.statusFilter() ?? undefined,
        limit,
        offset,
      });

      this.quests.set(response.data);
      this.totalCount.set(response.total);
    } catch (err) {
      this.showError('Errore nel caricamento delle quest', err);
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Reagisce al cambio di filtro: riporta il paginator a pagina 0
   * e ricarica i dati.
   */
  onFilterChange(): void {
    if (this.paginator) {
      this.paginator.pageIndex = 0;
    }
    void this.loadQuests();
  }

  /**
   * Reagisce al cambio di pagina del paginator (offset/limit).
   */
  onPageChange(): void {
    void this.loadQuests();
  }

  /**
   * Naviga alla pagina di creazione di una nuova quest.
   * La pagina form sara' implementata nel Mini-step H.
   */
  onCreateClick(): void {
    void this.router.navigateByUrl('/admin/quests/new');
  }

  /**
   * Naviga alla pagina di modifica di una quest esistente.
   */
  onEditClick(quest: AnyQuest): void {
    void this.router.navigateByUrl(`/admin/quests/${quest.id}/edit`);
  }

  /**
   * Attiva una quest e ricarica la lista.
   */
  async onActivateClick(quest: AnyQuest): Promise<void> {
    try {
      await this.questsService.activate(quest.id);
      this.snackBar.open(`Quest "${quest.name}" attivata`, 'OK', { duration: 3000 });
      await this.loadQuests();
    } catch (err) {
      this.showError("Errore nell'attivazione", err);
    }
  }

  /**
   * Disattiva una quest e ricarica la lista.
   */
  async onDeactivateClick(quest: AnyQuest): Promise<void> {
    try {
      await this.questsService.deactivate(quest.id);
      this.snackBar.open(`Quest "${quest.name}" disattivata`, 'OK', { duration: 3000 });
      await this.loadQuests();
    } catch (err) {
      this.showError('Errore nella disattivazione', err);
    }
  }

  /**
   * Archivia una quest dopo conferma e ricarica la lista.
   */
  async onArchiveClick(quest: AnyQuest): Promise<void> {
    const confirmed = confirm(
      `Archiviare la quest "${quest.name}"? La quest non sara' piu' visibile ai giocatori ma resta nel sistema.`,
    );
    if (!confirmed) {
      return;
    }
    try {
      await this.questsService.archive(quest.id);
      this.snackBar.open(`Quest "${quest.name}" archiviata`, 'OK', { duration: 3000 });
      await this.loadQuests();
    } catch (err) {
      this.showError("Errore nell'archiviazione", err);
    }
  }

  /**
   * Mostra una snackbar di errore traducendo i codici HTTP comuni.
   */
  private showError(prefix: string, err: unknown): void {
    let detail = 'Errore sconosciuto';
    if (err instanceof HttpErrorResponse) {
      detail = err.error?.message ?? `HTTP ${err.status}`;
    }
    this.snackBar.open(`${prefix}: ${detail}`, 'Chiudi', { duration: 5000 });
  }
}
