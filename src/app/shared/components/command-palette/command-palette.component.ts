import {
  Component,
  inject,
  signal,
  computed,
  HostListener,
  OnInit,
  OnDestroy,
  ElementRef,
  ViewChild,
  AfterViewInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { QuestsAdminService } from '../../../core/services/quests-admin.service';
import { CollectiblesAdminService } from '../../../core/services/collectibles-admin.service';
import { QuestType } from '@trentino-quest/shared-types';
import type { AnyQuest, Collectible } from '@trentino-quest/shared-types';

export interface PaletteItem {
  id: string;
  label: string;
  sublabel?: string;
  category: 'quest' | 'collectible' | 'action' | 'nav';
  action: () => void;
}

@Component({
  selector: 'app-command-palette',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './command-palette.component.html',
  styleUrl: './command-palette.component.scss',
})
export class CommandPaletteComponent implements OnInit, OnDestroy, AfterViewInit {
  private readonly router = inject(Router);
  private readonly questsService = inject(QuestsAdminService);
  private readonly collectiblesService = inject(CollectiblesAdminService);

  @ViewChild('searchInput') searchInputRef!: ElementRef<HTMLInputElement>;

  readonly isOpen = signal(false);
  readonly query = signal('');
  readonly focusIndex = signal(0);

  private allQuests: AnyQuest[] = [];
  private allCollectibles: Collectible[] = [];

  private readonly navItems: PaletteItem[] = [
    {
      id: 'nav-dashboard',
      label: 'Dashboard',
      sublabel: 'Vai a Dashboard',
      category: 'nav',
      action: () => this.navigate('/admin'),
    },
    {
      id: 'nav-quests',
      label: 'Quest',
      sublabel: 'Vai alla lista quest',
      category: 'nav',
      action: () => this.navigate('/admin/quests'),
    },
    {
      id: 'nav-map',
      label: 'Mappa quest',
      sublabel: 'Vista geografica',
      category: 'nav',
      action: () => this.navigate('/admin/quests-map'),
    },
    {
      id: 'nav-collectibles',
      label: 'Collezionabili',
      sublabel: 'Vai ai collezionabili',
      category: 'nav',
      action: () => this.navigate('/admin/collectibles'),
    },
    {
      id: 'nav-businesses',
      label: 'Affiliazioni',
      sublabel: 'Gestisci affiliazioni',
      category: 'nav',
      action: () => this.navigate('/admin/businesses'),
    },
    {
      id: 'nav-settings',
      label: 'Impostazioni',
      sublabel: 'Vai alle impostazioni',
      category: 'nav',
      action: () => this.navigate('/admin/settings'),
    },
    {
      id: 'act-new-quest',
      label: 'Nuova quest',
      sublabel: 'Crea una nuova quest',
      category: 'action',
      action: () => this.navigate('/admin/quests/new'),
    },
    {
      id: 'act-new-coll',
      label: 'Nuovo collezionabile',
      sublabel: 'Crea un collezionabile',
      category: 'action',
      action: () => this.navigate('/admin/collectibles/new'),
    },
  ];

  readonly results = computed((): PaletteItem[] => {
    const q = this.query().trim().toLowerCase();
    if (!q) return this.navItems;

    const questItems: PaletteItem[] = this.allQuests
      .filter((quest) => (quest.name ?? '').toLowerCase().includes(q))
      .slice(0, 5)
      .map((quest) => ({
        id: `quest-${quest.id}`,
        label: quest.name ?? '',
        sublabel: `${this.questCoords(quest)} · ${quest.type === QuestType.PRIMARY ? '★ Principale' : '● Secondaria'}`,
        category: 'quest' as const,
        action: () => this.navigate(`/admin/quests/${quest.id}/edit`),
      }));

    const collItems: PaletteItem[] = this.allCollectibles
      .filter((c) => c.name.toLowerCase().includes(q))
      .slice(0, 3)
      .map((c) => ({
        id: `coll-${c.id}`,
        label: c.name,
        sublabel: c.rarity,
        category: 'collectible' as const,
        action: () => this.navigate(`/admin/collectibles/${c.id}/edit`),
      }));

    const navItems = this.navItems.filter(
      (item) =>
        item.label.toLowerCase().includes(q) || (item.sublabel ?? '').toLowerCase().includes(q),
    );

    return [...questItems, ...collItems, ...navItems];
  });

  ngOnInit(): void {
    void this.loadData();
  }

  ngAfterViewInit(): void {
    // Focus the input when palette opens (called from shell after setting isOpen)
  }

  ngOnDestroy(): void {
    /* nothing to clean up */
  }

  open(): void {
    this.isOpen.set(true);
    this.query.set('');
    this.focusIndex.set(0);
    // Focus input on next tick
    setTimeout(() => this.searchInputRef?.nativeElement.focus(), 0);
  }

  close(): void {
    this.isOpen.set(false);
    this.query.set('');
  }

  @HostListener('document:keydown', ['$event'])
  onKeyDown(e: KeyboardEvent): void {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      if (this.isOpen()) {
        this.close();
      } else {
        this.open();
      }
      return;
    }
    if (!this.isOpen()) return;
    if (e.key === 'Escape') {
      this.close();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.focusIndex.update((i) => Math.min(i + 1, this.results().length - 1));
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.focusIndex.update((i) => Math.max(i - 1, 0));
    }
    if (e.key === 'Enter') {
      const item = this.results()[this.focusIndex()];
      if (item) {
        item.action();
        this.close();
      }
    }
  }

  selectItem(item: PaletteItem): void {
    item.action();
    this.close();
  }

  categoryLabel(cat: PaletteItem['category']): string {
    const map: Record<PaletteItem['category'], string> = {
      quest: 'Quest',
      collectible: 'Collezionabile',
      action: 'Azione',
      nav: 'Navigazione',
    };
    return map[cat];
  }

  private questCoords(quest: AnyQuest): string {
    const geo = quest.type === QuestType.PRIMARY ? quest.searchArea : quest.position;
    if (!geo) return '';
    return `${geo.lat.toFixed(3)}, ${geo.lng.toFixed(3)}`;
  }

  private navigate(url: string): void {
    void this.router.navigateByUrl(url);
  }

  private async loadData(): Promise<void> {
    try {
      const [questsRes, collectibles] = await Promise.all([
        this.questsService.list({ limit: 500, offset: 0 }),
        this.collectiblesService.list(),
      ]);
      this.allQuests = questsRes.data;
      this.allCollectibles = collectibles;
    } catch {
      /* silently ignore — palette search is best-effort */
    }
  }
}
