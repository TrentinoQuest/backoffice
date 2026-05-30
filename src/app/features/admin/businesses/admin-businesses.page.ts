import { Component, computed, inject, signal, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule, DatePipe, TitleCasePipe } from '@angular/common';
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
import { Business, BusinessApprovalStatus } from '@trentino-quest/shared-types';
import { BusinessAdminService } from '../../../core/services/business-admin.service';

/**
 * Pagina amministrativa per la gestione delle affiliazioni delle
 * Attivita Locali (RF38 del Deliverable D1).
 *
 * Mostra una tabella paginata delle attivita con filtro per stato di
 * approvazione. Per ogni attivita pending sono disponibili le azioni di
 * approvazione e rifiuto.
 */
@Component({
  selector: 'app-admin-businesses',
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
  templateUrl: './admin-businesses.page.html',
  styleUrl: './admin-businesses.page.scss',
})
export class AdminBusinessesPage implements AfterViewInit {
  private readonly businessService = inject(BusinessAdminService);
  private readonly snackBar = inject(MatSnackBar);

  @ViewChild(MatPaginator) paginator!: MatPaginator;

  readonly displayedColumns = [
    'businessName',
    'businessType',
    'address',
    'approvalStatus',
    'createdAt',
    'actions',
  ];

  readonly statusOptions: { value: BusinessApprovalStatus | null; label: string }[] = [
    { value: null, label: 'Tutti gli stati' },
    { value: BusinessApprovalStatus.PENDING, label: 'In attesa' },
    { value: BusinessApprovalStatus.APPROVED, label: 'Approvate' },
    { value: BusinessApprovalStatus.REJECTED, label: 'Rifiutate' },
  ];

  readonly statusFilter = signal<BusinessApprovalStatus | null>(BusinessApprovalStatus.PENDING);

  readonly businesses = signal<Business[]>([]);
  readonly totalCount = signal(0);
  readonly isLoading = signal(false);

  readonly BusinessApprovalStatus = BusinessApprovalStatus;

  /**
   * Helper visivo per lo stato di approvazione: ritorna una classe CSS
   * per colorare il badge.
   */
  statusClass = computed(
    () =>
      (status: BusinessApprovalStatus): string =>
        `badge badge-${status}`,
  );

  ngAfterViewInit(): void {
    this.loadBusinesses();
  }

  /**
   * Carica le attivita dal backend usando il filtro corrente e lo stato
   * del paginator.
   */
  async loadBusinesses(): Promise<void> {
    this.isLoading.set(true);
    try {
      const limit = this.paginator?.pageSize ?? 20;
      const offset = (this.paginator?.pageIndex ?? 0) * limit;

      const response = await this.businessService.list({
        approvalStatus: this.statusFilter() ?? undefined,
        limit,
        offset,
      });

      this.businesses.set(response.data);
      this.totalCount.set(response.total);
    } catch (err) {
      this.showError('Errore nel caricamento delle attivita', err);
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Reagisce al cambio di filtro: riporta il paginator a pagina 0 e
   * ricarica i dati.
   */
  onFilterChange(): void {
    if (this.paginator) {
      this.paginator.pageIndex = 0;
    }
    void this.loadBusinesses();
  }

  onPageChange(): void {
    void this.loadBusinesses();
  }

  /**
   * Approva un'attivita dopo conferma e ricarica la lista.
   */
  async onApproveClick(business: Business): Promise<void> {
    const confirmed = confirm(
      `Approvare l'affiliazione di "${business.businessName}"? L'attivita potra' pubblicare offerte.`,
    );
    if (!confirmed) {
      return;
    }
    try {
      await this.businessService.approve(business.id);
      this.snackBar.open(`"${business.businessName}" approvata`, 'OK', { duration: 3000 });
      await this.loadBusinesses();
    } catch (err) {
      this.showError("Errore nell'approvazione", err);
    }
  }

  /**
   * Rifiuta un'attivita dopo conferma e ricarica la lista.
   */
  async onRejectClick(business: Business): Promise<void> {
    const confirmed = confirm(`Rifiutare l'affiliazione di "${business.businessName}"?`);
    if (!confirmed) {
      return;
    }
    try {
      await this.businessService.reject(business.id);
      this.snackBar.open(`"${business.businessName}" rifiutata`, 'OK', { duration: 3000 });
      await this.loadBusinesses();
    } catch (err) {
      this.showError('Errore nel rifiuto', err);
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
