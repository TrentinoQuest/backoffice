import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AnyQuest, QuestStatus, QuestType } from '@trentino-quest/shared-types';
import { QuestsAdminService } from '../../../core/services/quests-admin.service';
import { CollectiblesAdminService } from '../../../core/services/collectibles-admin.service';
import { BreadcrumbService } from '../../../core/services/breadcrumb.service';
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

  readonly QuestType = QuestType;
  readonly QuestStatus = QuestStatus;

  readonly quests = signal<AnyQuest[]>([]);
  readonly selectedQuestId = signal<string | null>(null);
  readonly typeFilter = signal<QuestType | null>(null);
  readonly showActiveOnly = signal(false);
  readonly searchQuery = signal('');
  readonly collectiblesById = signal<Record<string, string>>({});
  readonly collectibleImages = signal<Record<string, string>>({});

  readonly filteredQuests = computed(() => {
    const q = this.searchQuery().toLowerCase();
    return this.quests().filter((quest) => {
      if (this.typeFilter() && quest.type !== this.typeFilter()) return false;
      if (this.showActiveOnly() && quest.status !== QuestStatus.ACTIVE) return false;
      if (q && !(quest.name ?? '').toLowerCase().includes(q)) return false;
      return true;
    });
  });

  readonly totalCount = computed(() => this.quests().length);
  readonly activeCount = computed(
    () => this.quests().filter((q) => q.status === QuestStatus.ACTIVE).length,
  );

  ngOnInit(): void {
    // hideShellToolbar: mappa a piena altezza, nessuna toolbar shell
    this.breadcrumb.set('Mappa quest', true);
    void this.loadData();
  }

  private async loadData(): Promise<void> {
    try {
      const [questsRes, collectibles] = await Promise.all([
        this.questsService.list({ limit: 500, offset: 0 }),
        this.collectiblesService.list(),
      ]);
      this.quests.set(questsRes.data);
      const byId: Record<string, string> = {};
      const imgById: Record<string, string> = {};
      for (const c of collectibles) {
        byId[c.id] = c.name;
        imgById[c.id] = c.imageUrl ?? '';
      }
      this.collectiblesById.set(byId);
      this.collectibleImages.set(imgById);
    } catch {
      this.snackBar.open('Errore caricamento dati', 'OK', { duration: 3000 });
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

  toggleActiveOnly(): void {
    this.showActiveOnly.update((v) => !v);
  }

  typeLabel(type: string): string {
    return type === QuestType.PRIMARY ? '★' : '●';
  }

  questPoints(quest: AnyQuest): number {
    return quest.basePoints ?? 0;
  }

  /** Sottotitolo lista: coordinate del punto della quest (lat, lng). */
  questSub(quest: AnyQuest): string {
    const geo = quest.type === QuestType.PRIMARY ? quest.searchArea : quest.position;
    if (!geo) {
      return '—';
    }
    return `${geo.lat.toFixed(4)}, ${geo.lng.toFixed(4)}`;
  }
}
