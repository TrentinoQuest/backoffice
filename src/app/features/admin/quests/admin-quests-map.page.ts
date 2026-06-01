import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AnyQuest, QuestStatus, QuestType } from '@trentino-quest/shared-types';
import { QuestsAdminService } from '../../../core/services/quests-admin.service';
import { CollectiblesAdminService } from '../../../core/services/collectibles-admin.service';
import { BreadcrumbService } from '../../../core/services/breadcrumb.service';
import { GeocodingService } from '../../../core/services/geocoding.service';
import { QuestMapViewerComponent } from '../../../shared/components/quest-map-viewer/quest-map-viewer.component';

@Component({
  selector: 'app-admin-quests-map',
  standalone: true,
  imports: [CommonModule, MatSnackBarModule, QuestMapViewerComponent],
  templateUrl: './admin-quests-map.page.html',
  styleUrl: './admin-quests-map.page.scss',
})
export class AdminQuestsMapPage implements OnInit {
  private readonly questsService = inject(QuestsAdminService);
  private readonly collectiblesService = inject(CollectiblesAdminService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);
  private readonly breadcrumb = inject(BreadcrumbService);
  private readonly geocoding = inject(GeocodingService);

  readonly QuestType = QuestType;
  readonly QuestStatus = QuestStatus;

  readonly quests = signal<AnyQuest[]>([]);
  readonly selectedQuestId = signal<string | null>(null);
  readonly typeFilter = signal<QuestType | null>(null);
  readonly showActiveOnly = signal(false);
  readonly searchQuery = signal('');
  readonly collectiblesById = signal<Record<string, string>>({});
  readonly collectibleImages = signal<Record<string, string>>({});
  readonly placeNames = signal<Record<string, string>>({});

  readonly filteredQuests = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const names = this.placeNames();
    const collById = this.collectiblesById();
    return this.quests().filter((quest) => {
      if (this.typeFilter() && quest.type !== this.typeFilter()) return false;
      if (this.showActiveOnly() && quest.status !== QuestStatus.ACTIVE) return false;
      if (q) {
        const collName =
          quest.type === QuestType.PRIMARY && quest.collectibleId
            ? (collById[quest.collectibleId] ?? '')
            : '';
        const haystack = [quest.name ?? '', names[quest.id] ?? '', collName]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  });

  readonly totalCount = computed(() => this.quests().length);
  readonly activeCount = computed(
    () => this.quests().filter((q) => q.status === QuestStatus.ACTIVE).length,
  );

  ngOnInit(): void {
    // Stessa breadcrumb della lista: la mappa è una vista alternativa
    // della pagina Quest, non una pagina separata. Toolbar shell visibile.
    this.breadcrumb.set('Quest');
    void this.loadData();
  }

  private async loadData(): Promise<void> {
    // Le quest sono il dato critico: se falliscono, mostriamo errore.
    try {
      const questsRes = await this.questsService.list({ limit: 100, offset: 0 });
      this.quests.set(questsRes.data);
      void this.resolvePlaceNames(questsRes.data);
    } catch {
      this.snackBar.open('Errore nel caricamento delle quest', 'OK', { duration: 3000 });
      return;
    }

    // I collezionabili arricchiscono i popup ma non sono essenziali:
    // un loro errore non deve impedire la visualizzazione della mappa.
    try {
      const collectibles = await this.collectiblesService.list();
      const byId: Record<string, string> = {};
      const imgById: Record<string, string> = {};
      for (const c of collectibles) {
        byId[c.id] = c.name;
        imgById[c.id] = c.imageUrl ?? '';
      }
      this.collectiblesById.set(byId);
      this.collectibleImages.set(imgById);
    } catch {
      /* best-effort: popup senza dettagli collezionabile */
    }
  }

  /** Reverse-geocoding in background per i sottotitoli della lista. */
  private async resolvePlaceNames(quests: AnyQuest[]): Promise<void> {
    for (const quest of quests) {
      const geo = quest.type === QuestType.PRIMARY ? quest.searchArea : quest.position;
      if (!geo) continue;
      const label = await this.geocoding.reverse(geo.lat, geo.lng);
      this.placeNames.update((m) => ({ ...m, [quest.id]: label }));
    }
  }

  onMapQuestSelected(id: string): void {
    void this.router.navigate(['/admin/quests', id, 'edit']);
  }

  onListItemClick(quest: AnyQuest): void {
    this.selectedQuestId.set(quest.id);
  }

  goToList(): void {
    void this.router.navigateByUrl('/admin/quests');
  }

  onCreateClick(): void {
    void this.router.navigate(['/admin/quests/new']);
  }

  toggleActiveOnly(): void {
    this.showActiveOnly.update((v) => !v);
  }

  typeLabel(type: string): string {
    return type === QuestType.PRIMARY ? '★' : '●';
  }

  questPoints(quest: AnyQuest): number {
    return quest.basePoints ?? 0;
  }

  /** Sottotitolo lista: luogo fisico risolto, con coordinate come fallback. */
  questSub(quest: AnyQuest): string {
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
