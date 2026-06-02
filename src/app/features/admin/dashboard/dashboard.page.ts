import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  AnyQuest,
  Business,
  BusinessApprovalStatus,
  QuestStatus,
} from '@trentino-quest/shared-types';
import { QuestsAdminService } from '../../../core/services/quests-admin.service';
import { CollectiblesAdminService } from '../../../core/services/collectibles-admin.service';
import { BusinessAdminService } from '../../../core/services/business-admin.service';
import { BreadcrumbService } from '../../../core/services/breadcrumb.service';
import { QuestMapViewerComponent } from '../../../shared/components/quest-map-viewer/quest-map-viewer.component';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, QuestMapViewerComponent],
  templateUrl: './dashboard.page.html',
  styleUrl: './dashboard.page.scss',
})
export class AdminDashboardPage implements OnInit {
  private readonly questsService = inject(QuestsAdminService);
  private readonly collectiblesService = inject(CollectiblesAdminService);
  private readonly businessService = inject(BusinessAdminService);
  private readonly breadcrumb = inject(BreadcrumbService);
  private readonly router = inject(Router);

  readonly isLoading = signal(false);

  readonly activeQuestsCount = signal(0);
  readonly inactiveQuestsCount = signal(0);
  readonly collectiblesCount = signal(0);
  readonly pendingBusinesses = signal<Business[]>([]);
  readonly activeQuests = signal<AnyQuest[]>([]);

  readonly pendingCount = computed(() => this.pendingBusinesses().length);
  readonly totalQuests = computed(() => this.activeQuestsCount() + this.inactiveQuestsCount());
  readonly activeRatio = computed(() => {
    const total = this.totalQuests();
    return total === 0 ? 0 : Math.round((this.activeQuestsCount() / total) * 100);
  });

  ngOnInit(): void {
    this.breadcrumb.set('Dashboard');
    void this.load();
  }

  async load(): Promise<void> {
    this.isLoading.set(true);
    try {
      const [active, inactive, collectibles, pending] = await Promise.all([
        this.questsService.list({ status: QuestStatus.ACTIVE, limit: 100, offset: 0 }),
        this.questsService.list({ status: QuestStatus.INACTIVE, limit: 1, offset: 0 }),
        this.collectiblesService.list(),
        this.businessService.list({
          approvalStatus: BusinessApprovalStatus.PENDING,
          limit: 100,
          offset: 0,
        }),
      ]);
      this.activeQuestsCount.set(active.total);
      this.activeQuests.set(active.data);
      this.inactiveQuestsCount.set(inactive.total);
      this.collectiblesCount.set(collectibles.length);
      this.pendingBusinesses.set(pending.data);
    } finally {
      this.isLoading.set(false);
    }
  }

  goTo(url: string): void {
    void this.router.navigateByUrl(url);
  }
}
