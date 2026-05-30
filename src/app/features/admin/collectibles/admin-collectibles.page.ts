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
import { Collectible, CollectibleRarity, CollectibleStatus } from '@trentino-quest/shared-types';
import { CollectiblesAdminService } from '../../../core/services/collectibles-admin.service';

@Component({
  selector: 'app-admin-collectibles',
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
  templateUrl: './admin-collectibles.page.html',
  styleUrl: './admin-collectibles.page.scss',
})
export class AdminCollectiblesPage implements AfterViewInit {
  private readonly collectiblesService = inject(CollectiblesAdminService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);

  @ViewChild(MatPaginator) paginator!: MatPaginator;

  readonly displayedColumns = ['image', 'name', 'rarity', 'createdAt', 'actions'];

  readonly rarityOptions: { value: CollectibleRarity | null; label: string }[] = [
    { value: null, label: 'Tutte le rarità' },
    { value: CollectibleRarity.COMMON, label: 'Comune' },
    { value: CollectibleRarity.UNCOMMON, label: 'Non comune' },
    { value: CollectibleRarity.RARE, label: 'Raro' },
    { value: CollectibleRarity.LEGENDARY, label: 'Leggendario' },
  ];

  readonly statusOptions: { value: CollectibleStatus | null; label: string }[] = [
    { value: null, label: 'Tutti gli stati' },
    { value: CollectibleStatus.ACTIVE, label: 'Attivi' },
    { value: CollectibleStatus.ARCHIVED, label: 'Archiviati' },
  ];

  readonly rarityFilter = signal<CollectibleRarity | null>(null);
  readonly statusFilter = signal<CollectibleStatus | null>(null);
  readonly pageIndex = signal(0);
  readonly pageSize = signal(20);

  private readonly allCollectibles = signal<Collectible[]>([]);
  readonly isLoading = signal(false);

  readonly filteredCollectibles = computed(() => {
    const rarity = this.rarityFilter();
    const status = this.statusFilter();
    return this.allCollectibles().filter(
      (c) => (!rarity || c.rarity === rarity) && (!status || c.status === status),
    );
  });

  readonly totalCount = computed(() => this.filteredCollectibles().length);

  readonly collectibles = computed(() => {
    const start = this.pageIndex() * this.pageSize();
    return this.filteredCollectibles().slice(start, start + this.pageSize());
  });

  rarityClass = computed(
    () =>
      (rarity: CollectibleRarity): string =>
        `badge badge-${rarity}`,
  );

  ngAfterViewInit(): void {
    void this.loadCollectibles();
  }

  async loadCollectibles(): Promise<void> {
    this.isLoading.set(true);
    try {
      const data = await this.collectiblesService.list();
      this.allCollectibles.set(data);
    } catch (err) {
      this.showError('Errore nel caricamento dei collezionabili', err);
    } finally {
      this.isLoading.set(false);
    }
  }

  onFilterChange(): void {
    this.pageIndex.set(0);
    if (this.paginator) {
      this.paginator.pageIndex = 0;
    }
  }

  onPageChange(): void {
    this.pageIndex.set(this.paginator.pageIndex);
    this.pageSize.set(this.paginator.pageSize);
  }

  onCreateClick(): void {
    void this.router.navigateByUrl('/admin/collectibles/new');
  }

  onEditClick(collectible: Collectible): void {
    void this.router.navigateByUrl(`/admin/collectibles/${collectible.id}/edit`);
  }

  async onArchiveClick(collectible: Collectible): Promise<void> {
    const confirmed = confirm(
      `Archiviare il collezionabile "${collectible.name}"? Non sara' piu' assegnabile a nuove quest, ma resta negli album dei giocatori che lo possiedono.`,
    );
    if (!confirmed) {
      return;
    }
    try {
      await this.collectiblesService.archive(collectible.id);
      this.snackBar.open(`Collezionabile "${collectible.name}" archiviato`, 'OK', {
        duration: 3000,
      });
      await this.loadCollectibles();
    } catch (err) {
      this.showError("Errore nell'archiviazione", err);
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
