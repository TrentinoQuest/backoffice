import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Business, BusinessApprovalStatus, BusinessType } from '@trentino-quest/shared-types';
import { BusinessAdminService } from '../../../core/services/business-admin.service';
import { BreadcrumbService } from '../../../core/services/breadcrumb.service';
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
  selector: 'app-admin-businesses',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    FilterChipsComponent,
    MatDialogModule,
    MatSnackBarModule,
    MatTooltipModule,
  ],
  templateUrl: './admin-businesses.page.html',
  styleUrl: './admin-businesses.page.scss',
})
export class AdminBusinessesPage implements OnInit {
  private readonly service = inject(BusinessAdminService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly breadcrumb = inject(BreadcrumbService);
  private readonly dialog = inject(MatDialog);

  readonly BusinessApprovalStatus = BusinessApprovalStatus;

  readonly isLoading = signal(false);
  readonly businesses = signal<Business[]>([]);
  readonly statusFilter = signal<BusinessApprovalStatus | null>(BusinessApprovalStatus.PENDING);

  readonly statusGroups: FilterGroup<BusinessApprovalStatus | null>[] = [
    {
      chips: [
        { label: 'Tutte', value: null },
        { label: 'In attesa', value: BusinessApprovalStatus.PENDING },
        { label: 'Approvate', value: BusinessApprovalStatus.APPROVED },
        { label: 'Rifiutate', value: BusinessApprovalStatus.REJECTED },
      ],
    },
  ];

  ngOnInit(): void {
    this.breadcrumb.set('Affiliazioni');
    void this.load();
  }

  async load(): Promise<void> {
    this.isLoading.set(true);
    try {
      const res = await this.service.list({
        approvalStatus: this.statusFilter() ?? undefined,
        limit: 100,
        offset: 0,
      });
      this.businesses.set(res.data);
    } catch (err) {
      this.showError('Errore nel caricamento delle attività', err);
    } finally {
      this.isLoading.set(false);
    }
  }

  onStatusFilter(value: BusinessApprovalStatus | null): void {
    this.statusFilter.set(value);
    void this.load();
  }

  async onApprove(b: Business): Promise<void> {
    const data: ConfirmDialogData = {
      title: "Approvare l'affiliazione?",
      message: `"${b.businessName}" potrà pubblicare offerte per i giocatori.`,
      confirmLabel: 'Approva',
    };
    const ok = await firstValueFrom(
      this.dialog.open(ConfirmDialogComponent, { data, width: '440px' }).afterClosed(),
    );
    if (!ok) return;
    try {
      await this.service.approve(b.id);
      this.snackBar.open(`"${b.businessName}" approvata`, 'OK', { duration: 3000 });
      await this.load();
    } catch (err) {
      this.showError("Errore nell'approvazione", err);
    }
  }

  async onRevoke(b: Business): Promise<void> {
    const data: ConfirmDialogData = {
      title: "Revocare l'accesso?",
      message: `"${b.businessName}" non potrà più pubblicare offerte finché non verrà ri-approvata.`,
      confirmLabel: 'Revoca',
      danger: true,
    };
    const ok = await firstValueFrom(
      this.dialog.open(ConfirmDialogComponent, { data, width: '440px' }).afterClosed(),
    );
    if (!ok) return;
    try {
      await this.service.reject(b.id);
      this.snackBar.open(`Accesso revocato a "${b.businessName}"`, 'OK', { duration: 3000 });
      await this.load();
    } catch (err) {
      this.showError('Errore nella revoca', err);
    }
  }

  async onReject(b: Business): Promise<void> {
    const data: ConfirmDialogData = {
      title: "Rifiutare l'affiliazione?",
      message: `La richiesta di "${b.businessName}" verrà rifiutata.`,
      confirmLabel: 'Rifiuta',
      danger: true,
    };
    const ok = await firstValueFrom(
      this.dialog.open(ConfirmDialogComponent, { data, width: '440px' }).afterClosed(),
    );
    if (!ok) return;
    try {
      await this.service.reject(b.id);
      this.snackBar.open(`"${b.businessName}" rifiutata`, 'OK', { duration: 3000 });
      await this.load();
    } catch (err) {
      this.showError('Errore nel rifiuto', err);
    }
  }

  typeLabel(t: BusinessType): string {
    const map: Record<BusinessType, string> = {
      [BusinessType.RESTAURANT]: 'Ristorante',
      [BusinessType.MUSEUM]: 'Museo',
      [BusinessType.FARM_STAY]: 'Agriturismo',
      [BusinessType.MOUNTAIN_HUT]: 'Rifugio',
      [BusinessType.OTHER]: 'Altro',
    };
    return map[t] ?? t;
  }

  statusLabel(s: BusinessApprovalStatus): string {
    const map: Record<BusinessApprovalStatus, string> = {
      [BusinessApprovalStatus.PENDING]: 'In attesa',
      [BusinessApprovalStatus.APPROVED]: 'Approvata',
      [BusinessApprovalStatus.REJECTED]: 'Rifiutata',
    };
    return map[s];
  }

  statusBadgeClass(s: BusinessApprovalStatus): string {
    switch (s) {
      case BusinessApprovalStatus.APPROVED:
        return 'tq-badge tq-badge--green';
      case BusinessApprovalStatus.PENDING:
        return 'tq-badge tq-badge--amber';
      case BusinessApprovalStatus.REJECTED:
        return 'tq-badge tq-badge--danger';
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
