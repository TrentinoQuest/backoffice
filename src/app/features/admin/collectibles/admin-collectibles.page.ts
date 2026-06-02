import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Collectible, CollectibleRarity } from '@trentino-quest/shared-types';
import { CollectiblesAdminService } from '../../../core/services/collectibles-admin.service';
import { BreadcrumbService } from '../../../core/services/breadcrumb.service';
import { PreferencesService } from '../../../core/services/preferences.service';
import {
  FilterChipsComponent,
  FilterGroup,
} from '../../../shared/components/filter-chips/filter-chips.component';
import {
  ConfirmDialogComponent,
  ConfirmDialogData,
} from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-admin-collectibles',
  standalone: true,
  imports: [
    CommonModule,
    FilterChipsComponent,
    MatDialogModule,
    MatSnackBarModule,
    MatTooltipModule,
  ],
  templateUrl: './admin-collectibles.page.html',
  styleUrl: './admin-collectibles.page.scss',
})
export class AdminCollectiblesPage implements OnInit {
  private readonly service = inject(CollectiblesAdminService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);
  private readonly breadcrumb = inject(BreadcrumbService);
  private readonly prefs = inject(PreferencesService);
  private readonly dialog = inject(MatDialog);

  readonly CollectibleRarity = CollectibleRarity;

  readonly isLoading = signal(false);
  readonly all = signal<Collectible[]>([]);
  readonly rarityFilter = signal<CollectibleRarity | null>(null);

  readonly rarityGroups: FilterGroup<CollectibleRarity | null>[] = [
    {
      chips: [
        { label: 'Tutte', value: null },
        { label: 'Comune', value: CollectibleRarity.COMMON },
        { label: 'Non comune', value: CollectibleRarity.UNCOMMON },
        { label: 'Raro', value: CollectibleRarity.RARE },
        { label: 'Leggendario', value: CollectibleRarity.LEGENDARY },
      ],
    },
  ];

  readonly filtered = computed(() => {
    const r = this.rarityFilter();
    return this.all().filter((c) => !r || c.rarity === r);
  });

  ngOnInit(): void {
    this.breadcrumb.set('Collezionabili');
    void this.load();
  }

  async load(): Promise<void> {
    this.isLoading.set(true);
    try {
      this.all.set(await this.service.list());
    } catch (err) {
      this.showError('Errore nel caricamento dei collezionabili', err);
    } finally {
      this.isLoading.set(false);
    }
  }

  onRarityFilter(value: CollectibleRarity | null): void {
    this.rarityFilter.set(value);
  }

  onCreate(): void {
    void this.router.navigateByUrl('/admin/collectibles/new');
  }

  onEdit(c: Collectible): void {
    void this.router.navigate(['/admin/collectibles', c.id, 'edit']);
  }

  async onArchive(c: Collectible, event: MouseEvent): Promise<void> {
    event.stopPropagation();
    if (this.prefs.confirmBeforeArchive()) {
      const data: ConfirmDialogData = {
        title: 'Archiviare il collezionabile?',
        message: `"${c.name}" non sarà più assegnabile a nuove quest, ma resta negli album dei giocatori che lo possiedono già.`,
        confirmLabel: 'Archivia',
        danger: true,
      };
      const ok = await firstValueFrom(
        this.dialog.open(ConfirmDialogComponent, { data, width: '440px' }).afterClosed(),
      );
      if (!ok) return;
    }
    try {
      await this.service.archive(c.id);
      this.snackBar.open(`"${c.name}" archiviato`, 'OK', { duration: 3000 });
      await this.load();
    } catch (err) {
      this.showError("Errore nell'archiviazione", err);
    }
  }

  rarityLabel(r: CollectibleRarity): string {
    const map: Record<CollectibleRarity, string> = {
      [CollectibleRarity.COMMON]: 'Comune',
      [CollectibleRarity.UNCOMMON]: 'Non comune',
      [CollectibleRarity.RARE]: 'Raro',
      [CollectibleRarity.LEGENDARY]: 'Leggendario',
    };
    return map[r];
  }

  rarityBadgeClass(r: CollectibleRarity): string {
    switch (r) {
      case CollectibleRarity.COMMON:
        return 'tq-badge tq-badge--gray';
      case CollectibleRarity.UNCOMMON:
        return 'tq-badge tq-badge--green';
      case CollectibleRarity.RARE:
      case CollectibleRarity.LEGENDARY:
        return 'tq-badge tq-badge--amber';
    }
  }

  private showError(prefix: string, err: unknown): void {
    let detail = 'Errore sconosciuto';
    if (err instanceof HttpErrorResponse) {
      detail = err.error?.message ?? `HTTP ${err.status}`;
    }
    this.snackBar.open(`${prefix}: ${detail}`, 'Chiudi', { duration: 5000 });
  }
}
