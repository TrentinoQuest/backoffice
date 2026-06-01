import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AnyQuest, QuestStatus, QuestType } from '@trentino-quest/shared-types';
import { QuestsAdminService } from '../../../core/services/quests-admin.service';
import { BreadcrumbService } from '../../../core/services/breadcrumb.service';
import { GeocodingService } from '../../../core/services/geocoding.service';
import {
  FilterChipsComponent,
  FilterGroup,
} from '../../../shared/components/filter-chips/filter-chips.component';

@Component({
  selector: 'app-admin-quests',
  standalone: true,
  imports: [CommonModule, MatSnackBarModule, FilterChipsComponent],
  templateUrl: './admin-quests.page.html',
  styleUrl: './admin-quests.page.scss',
})
export class AdminQuestsPage implements OnInit {
  private readonly questsService = inject(QuestsAdminService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);
  private readonly breadcrumb = inject(BreadcrumbService);
  private readonly geocoding = inject(GeocodingService);

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
    void this.loadQuests();
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

  onCreateClick(): void {
    void this.router.navigate(['/admin/quests/new']);
  }
  onEditClick(quest: AnyQuest): void {
    void this.router.navigate(['/admin/quests', quest.id, 'edit']);
  }
  goToMap(): void {
    void this.router.navigateByUrl('/admin/quests-map');
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
