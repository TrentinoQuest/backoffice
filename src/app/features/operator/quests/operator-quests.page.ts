import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { OperatorQuestView, PlacementStatus } from '@trentino-quest/shared-types';
import { OperatorService } from '../../../core/services/operator.service';
import {
  FilterChipsComponent,
  FilterGroup,
} from '../../../shared/components/filter-chips/filter-chips.component';
import {
  PlaceQuestDialogComponent,
  PlaceQuestDialogData,
  PlaceQuestDialogResult,
} from './place-quest-dialog.component';
import {
  ReportIssueDialogComponent,
  ReportIssueDialogData,
  ReportIssueDialogResult,
} from './report-issue-dialog.component';
import { firstValueFrom } from 'rxjs';

const PAGE_SIZE = 20;

@Component({
  selector: 'app-operator-quests',
  standalone: true,
  imports: [
    CommonModule,
    FilterChipsComponent,
    MatDialogModule,
    MatSnackBarModule,
    MatTooltipModule,
  ],
  templateUrl: './operator-quests.page.html',
  styleUrl: './operator-quests.page.scss',
})
export class OperatorQuestsPage implements OnInit {
  private readonly service = inject(OperatorService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);

  readonly PlacementStatus = PlacementStatus;

  readonly isLoading = signal(false);
  readonly quests = signal<OperatorQuestView[]>([]);
  readonly statusFilter = signal<PlacementStatus>(PlacementStatus.PENDING);
  readonly total = signal(0);
  readonly offset = signal(0);

  readonly filterGroups: FilterGroup<PlacementStatus>[] = [
    {
      chips: [
        { label: 'Da piazzare', value: PlacementStatus.PENDING },
        { label: 'Piazzati', value: PlacementStatus.PLACED },
        { label: 'Segnalati', value: PlacementStatus.REPORTED },
      ],
    },
  ];

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    this.isLoading.set(true);
    try {
      const res = await this.service.list({
        placementStatus: this.statusFilter(),
        limit: PAGE_SIZE,
        offset: this.offset(),
      });
      this.quests.set(res.data);
      this.total.set(res.total);
    } catch (err) {
      this.showError('Errore nel caricamento delle quest', err);
    } finally {
      this.isLoading.set(false);
    }
  }

  onStatusFilter(value: PlacementStatus | null): void {
    if (value === null) return;
    this.statusFilter.set(value);
    this.offset.set(0);
    void this.load();
  }

  prevPage(): void {
    this.offset.update((o) => Math.max(0, o - PAGE_SIZE));
    void this.load();
  }

  nextPage(): void {
    this.offset.update((o) => o + PAGE_SIZE);
    void this.load();
  }

  hasPrev(): boolean {
    return this.offset() > 0;
  }

  hasNext(): boolean {
    return this.offset() + PAGE_SIZE < this.total();
  }

  currentPage(): number {
    return Math.floor(this.offset() / PAGE_SIZE) + 1;
  }

  totalPages(): number {
    return Math.max(1, Math.ceil(this.total() / PAGE_SIZE));
  }

  async onPlace(quest: OperatorQuestView): Promise<void> {
    const data: PlaceQuestDialogData = {
      questName: quest.name ?? quest.id,
      mode: 'place',
    };
    const result = (await firstValueFrom(
      this.dialog
        .open(PlaceQuestDialogComponent, { data, width: '580px', maxWidth: '95vw' })
        .afterClosed(),
    )) as PlaceQuestDialogResult | undefined;

    if (!result) return;

    try {
      await this.service.place(quest.id, {
        exactPosition: result.exactPosition,
        fix: result.fix,
      });
      this.snackBar.open(`QR piazzato per "${quest.name}"`, 'OK', { duration: 3000 });
      await this.load();
    } catch (err) {
      this.showPlacementError(err);
    }
  }

  async onUpdatePosition(quest: OperatorQuestView): Promise<void> {
    const data: PlaceQuestDialogData = {
      questName: quest.name ?? quest.id,
      mode: 'update',
      currentPosition: quest.exactPosition,
    };
    const result = (await firstValueFrom(
      this.dialog
        .open(PlaceQuestDialogComponent, { data, width: '580px', maxWidth: '95vw' })
        .afterClosed(),
    )) as PlaceQuestDialogResult | undefined;

    if (!result) return;

    try {
      await this.service.updatePosition(quest.id, {
        exactPosition: result.exactPosition,
        fix: result.fix,
      });
      this.snackBar.open(`Posizione aggiornata per "${quest.name}"`, 'OK', { duration: 3000 });
      await this.load();
    } catch (err) {
      this.showPlacementError(err);
    }
  }

  async onReportIssue(quest: OperatorQuestView): Promise<void> {
    const data: ReportIssueDialogData = { questName: quest.name ?? quest.id };
    const result = (await firstValueFrom(
      this.dialog
        .open(ReportIssueDialogComponent, { data, width: '480px', maxWidth: '95vw' })
        .afterClosed(),
    )) as ReportIssueDialogResult | undefined;

    if (result === undefined) return;

    try {
      await this.service.reportIssue(quest.id, { note: result.note });
      this.snackBar.open(`Problema segnalato per "${quest.name}"`, 'OK', { duration: 3000 });
      await this.load();
    } catch (err) {
      this.showError('Errore nella segnalazione', err);
    }
  }

  placementStatusLabel(s: PlacementStatus): string {
    const map: Record<PlacementStatus, string> = {
      [PlacementStatus.PENDING]: 'Da piazzare',
      [PlacementStatus.PLACED]: 'Piazzato',
      [PlacementStatus.REPORTED]: 'Segnalato',
    };
    return map[s];
  }

  placementStatusBadgeClass(s: PlacementStatus): string {
    switch (s) {
      case PlacementStatus.PLACED:
        return 'tq-badge tq-badge--green';
      case PlacementStatus.PENDING:
        return 'tq-badge tq-badge--gray';
      case PlacementStatus.REPORTED:
        return 'tq-badge tq-badge--danger';
    }
  }

  searchAreaLabel(quest: OperatorQuestView): string {
    if (!quest.searchArea) return '—';
    return `${quest.searchArea.lat.toFixed(4)}, ${quest.searchArea.lng.toFixed(4)}`;
  }

  private showPlacementError(err: unknown): void {
    if (err instanceof HttpErrorResponse && err.status === 422) {
      const code = (err.error as { code?: string })?.code;
      if (code === 'OUT_OF_RANGE_ACCURACY') {
        this.snackBar.open("GPS troppo impreciso, riprova all'aperto con cielo libero.", 'Chiudi', {
          duration: 6000,
        });
        return;
      }
      if (code === 'STALE_FIX') {
        this.snackBar.open(
          'Fix GPS troppo vecchio. Riacquisisci la posizione e riprova subito.',
          'Chiudi',
          { duration: 6000 },
        );
        return;
      }
    }
    this.showError('Errore nel piazzamento', err);
  }

  private showError(prefix: string, err: unknown): void {
    let detail = 'Errore sconosciuto';
    if (err instanceof HttpErrorResponse) {
      detail = (err.error as { message?: string })?.message ?? `HTTP ${err.status}`;
    }
    this.snackBar.open(`${prefix}: ${detail}`, 'Chiudi', { duration: 5000 });
  }
}
