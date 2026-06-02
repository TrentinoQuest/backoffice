import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AnyQuest, PrimaryQuest, QuestStatus, QuestType } from '@trentino-quest/shared-types';
import { QuestsAdminService } from '../../../core/services/quests-admin.service';
import { CollectiblesAdminService } from '../../../core/services/collectibles-admin.service';
import { BreadcrumbService } from '../../../core/services/breadcrumb.service';
import { PreferencesService } from '../../../core/services/preferences.service';
import { GeocodingService } from '../../../core/services/geocoding.service';
import {
  FilterChipsComponent,
  FilterGroup,
} from '../../../shared/components/filter-chips/filter-chips.component';
import {
  ConfirmDialogComponent,
  ConfirmDialogData,
} from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { firstValueFrom } from 'rxjs';

interface CollectibleRef {
  name: string;
  imageUrl: string;
}

@Component({
  selector: 'app-admin-quests',
  standalone: true,
  imports: [
    CommonModule,
    MatSnackBarModule,
    MatDialogModule,
    MatTooltipModule,
    FilterChipsComponent,
  ],
  templateUrl: './admin-quests.page.html',
  styleUrl: './admin-quests.page.scss',
})
export class AdminQuestsPage implements OnInit {
  private readonly questsService = inject(QuestsAdminService);
  private readonly collectiblesService = inject(CollectiblesAdminService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);
  private readonly breadcrumb = inject(BreadcrumbService);
  private readonly prefs = inject(PreferencesService);
  private readonly dialog = inject(MatDialog);
  private readonly geocoding = inject(GeocodingService);

  /** Mappa collectibleId → {nome, immagine} per la colonna collezionabile. */
  readonly collectiblesById = signal<Record<string, CollectibleRef>>({});

  /** Etichette luogo (es. "Via Roma, Trento") risolte via reverse-geocoding, per quest id. */
  readonly placeNames = signal<Record<string, string>>({});

  readonly QuestType = QuestType;
  readonly QuestStatus = QuestStatus;

  readonly isLoading = signal(false);
  readonly quests = signal<AnyQuest[]>([]);
  readonly typeFilter = signal<QuestType | null>(null);
  readonly statusFilter = signal<QuestStatus | null>(null);
  readonly searchQuery = signal('');

  readonly typeGroups: FilterGroup<QuestType | null>[] = [
    {
      chips: [
        { label: 'Tutte', value: null },
        { label: '★ Principali', value: QuestType.PRIMARY },
        { label: '● Secondarie', value: QuestType.SECONDARY },
      ],
    },
  ];

  readonly statusGroups: FilterGroup<QuestStatus | null>[] = [
    {
      chips: [
        { label: 'Tutti gli stati', value: null },
        { label: 'Attive', value: QuestStatus.ACTIVE },
        { label: 'Inattive', value: QuestStatus.INACTIVE },
      ],
    },
  ];

  readonly filteredQuests = computed(() => {
    const q = this.searchQuery().toLowerCase();
    return this.quests().filter((quest) => {
      if (q && !(quest.name ?? '').toLowerCase().includes(q)) return false;
      return true;
    });
  });

  ngOnInit(): void {
    this.breadcrumb.set('Quest');
    void this.loadCollectibles();
    void this.loadQuests();
  }

  private async loadCollectibles(): Promise<void> {
    try {
      const list = await this.collectiblesService.list();
      const map: Record<string, CollectibleRef> = {};
      for (const c of list) {
        map[c.id] = { name: c.name, imageUrl: c.imageUrl };
      }
      this.collectiblesById.set(map);
    } catch {
      /* la colonna collezionabile resterà vuota: non bloccante */
    }
  }

  async loadQuests(): Promise<void> {
    this.isLoading.set(true);
    try {
      const res = await this.questsService.list({
        type: this.typeFilter() ?? undefined,
        status: this.statusFilter() ?? undefined,
        limit: 100,
        offset: 0,
      });
      this.quests.set(res.data);
      void this.resolvePlaceNames(res.data);
    } catch {
      this.snackBar.open('Errore nel caricamento delle quest', 'OK', { duration: 3000 });
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Ritorna il collezionabile associato a una quest primaria, se presente
   * e già caricato. Le quest secondarie non hanno collezionabile.
   */
  questCollectible(quest: AnyQuest): CollectibleRef | null {
    if (quest.type !== QuestType.PRIMARY) {
      return null;
    }
    const cid = (quest as PrimaryQuest).collectibleId;
    if (!cid) {
      return null;
    }
    return this.collectiblesById()[cid] ?? null;
  }

  /** Archivia una quest, previa conferma (se l'utente la richiede). */
  async onArchive(quest: AnyQuest, event: MouseEvent): Promise<void> {
    event.stopPropagation();
    if (this.prefs.confirmBeforeArchive()) {
      const data: ConfirmDialogData = {
        title: 'Archiviare la quest?',
        message: `"${quest.name}" verrà archiviata e non sarà più visibile ai giocatori.`,
        confirmLabel: 'Archivia',
        danger: true,
      };
      const ok = await firstValueFrom(
        this.dialog.open(ConfirmDialogComponent, { data, width: '440px' }).afterClosed(),
      );
      if (!ok) return;
    }
    try {
      await this.questsService.archive(quest.id);
      this.snackBar.open(`"${quest.name}" archiviata`, 'OK', { duration: 3000 });
      await this.loadQuests();
    } catch {
      this.snackBar.open("Errore nell'archiviazione", 'OK', { duration: 3000 });
    }
  }

  /**
   * Risolve in background le etichette luogo per le quest tramite
   * reverse-geocoding. Aggiorna placeNames mano a mano che arrivano.
   */
  private async resolvePlaceNames(quests: AnyQuest[]): Promise<void> {
    for (const quest of quests) {
      const geo = quest.type === QuestType.PRIMARY ? quest.searchArea : quest.position;
      if (!geo) continue;
      const label = await this.geocoding.reverse(geo.lat, geo.lng);
      this.placeNames.update((m) => ({ ...m, [quest.id]: label }));
    }
  }

  onTypeFilter(value: QuestType | null): void {
    this.typeFilter.set(value);
    void this.loadQuests();
  }

  onStatusFilter(value: QuestStatus | null): void {
    this.statusFilter.set(value);
    void this.loadQuests();
  }
  onEditClick(quest: AnyQuest): void {
    void this.router.navigate(['/admin/quests', quest.id, 'edit']);
  }

  typeLabel(type: string): string {
    return type === QuestType.PRIMARY ? '★ Principale' : '● Secondaria';
  }

  statusLabel(status: string): string {
    const map: Record<string, string> = {
      [QuestStatus.ACTIVE]: 'Attiva',
      [QuestStatus.INACTIVE]: 'Inattiva',
      [QuestStatus.ARCHIVED]: 'Archiviata',
    };
    return map[status] ?? status;
  }

  typeBadgeClass(type: string): string {
    return type === QuestType.PRIMARY ? 'tq-badge tq-badge--green' : 'tq-badge tq-badge--gray';
  }

  statusBadgeClass(status: string): string {
    return status === QuestStatus.ACTIVE ? 'tq-badge tq-badge--green' : 'tq-badge tq-badge--gray';
  }

  /**
   * Etichetta posizione: mostra il luogo fisico (es. "Via Roma, Trento")
   * risolto via reverse-geocoding; finché non è disponibile, mostra le
   * coordinate del punto come fallback.
   */
  questPlace(quest: AnyQuest): string {
    const resolved = this.placeNames()[quest.id];
    if (resolved) {
      return resolved;
    }
    const geo = quest.type === QuestType.PRIMARY ? quest.searchArea : quest.position;
    if (!geo) {
      return '—';
    }
    return `${geo.lat.toFixed(4)}, ${geo.lng.toFixed(4)}`;
  }
}
