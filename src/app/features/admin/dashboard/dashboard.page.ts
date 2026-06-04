import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { BaseChartDirective } from 'ng2-charts';
import type { ChartData, ChartOptions } from 'chart.js';
import * as L from 'leaflet';
import 'leaflet.heat';
import {
  AnyQuest,
  AnalyticsGranularity,
  AnalyticsSummary,
  Business,
  BusinessApprovalStatus,
  CompletionsHeatmapPoint,
  CompletionsOverTimePoint,
  LeaderboardEntry,
  NeverCompletedQuestEntry,
  QuestStatus,
  QuestType,
  TopQuestEntry,
} from '@trentino-quest/shared-types';
import { QuestsAdminService } from '../../../core/services/quests-admin.service';
import { CollectiblesAdminService } from '../../../core/services/collectibles-admin.service';
import { BusinessAdminService } from '../../../core/services/business-admin.service';
import { AnalyticsService } from '../../../core/services/analytics.service';
import { BreadcrumbService } from '../../../core/services/breadcrumb.service';
import { QuestMapViewerComponent } from '../../../shared/components/quest-map-viewer/quest-map-viewer.component';
import {
  applyLeafletIconFix,
  createOsmTileLayer,
  TRENTINO_CENTER,
  TRENTINO_ZOOM,
} from '../../../shared/leaflet/leaflet-config';

// Tipo minimale per leaflet.heat (nessun pacchetto @types ufficiale disponibile)
type LeafletWithHeat = typeof L & {
  heatLayer(
    latlngs: [number, number, number?][],
    options?: {
      radius?: number;
      blur?: number;
      maxZoom?: number;
      gradient?: Record<string, string>;
    },
  ): L.Layer;
};

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    BaseChartDirective,
    QuestMapViewerComponent,
  ],
  templateUrl: './dashboard.page.html',
  styleUrl: './dashboard.page.scss',
})
export class AdminDashboardPage implements OnInit, AfterViewInit, OnDestroy {
  private readonly questsService = inject(QuestsAdminService);
  private readonly collectiblesService = inject(CollectiblesAdminService);
  private readonly businessService = inject(BusinessAdminService);
  private readonly analyticsService = inject(AnalyticsService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly breadcrumb = inject(BreadcrumbService);
  private readonly router = inject(Router);

  // ─── Stato esistente (mappa quest + contatori operativi) ─────────────────────

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

  // ─── Stato analytics ─────────────────────────────────────────────────────────

  readonly loadingSummary = signal(false);
  readonly loadingChart = signal(false);
  readonly loadingHeatmap = signal(false);
  readonly loadingTables = signal(false);

  readonly summary = signal<AnalyticsSummary | null>(null);
  readonly completionsOverTime = signal<CompletionsOverTimePoint[]>([]);
  readonly topQuests = signal<TopQuestEntry[]>([]);
  readonly neverCompleted = signal<NeverCompletedQuestEntry[]>([]);
  readonly leaderboard = signal<LeaderboardEntry[]>([]);

  readonly granularity = signal<AnalyticsGranularity>(AnalyticsGranularity.DAY);

  readonly AnalyticsGranularity = AnalyticsGranularity;
  readonly QuestType = QuestType;

  // Dati del grafico derivati dalla serie temporale
  readonly chartData = computed<ChartData<'bar'>>(() => {
    const points = this.completionsOverTime();
    return {
      labels: points.map((p) => this.formatChartLabel(p.date)),
      datasets: [
        {
          label: 'Completamenti',
          data: points.map((p) => p.count),
          backgroundColor: 'rgba(26, 92, 56, 0.75)',
          borderColor: '#1a5c38',
          borderWidth: 1,
          borderRadius: 4,
        },
      ],
    };
  });

  readonly chartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { mode: 'index', intersect: false },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { precision: 0 },
        grid: { color: 'rgba(0,0,0,0.06)' },
      },
      x: {
        grid: { display: false },
        ticks: { maxRotation: 45 },
      },
    },
  };

  // ─── Heatmap Leaflet ─────────────────────────────────────────────────────────

  @ViewChild('heatmapDiv') private heatmapDivRef?: ElementRef<HTMLDivElement>;

  private heatMap: L.Map | null = null;
  private heatLyr: L.Layer | null = null;

  // ─── Lifecycle ───────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.breadcrumb.set('Dashboard');
    void this.loadOperational();
    void this.loadSummary();
    void this.loadChart();
    void this.loadHeatmap();
    void this.loadTables();
  }

  ngAfterViewInit(): void {
    this.initHeatmap();
  }

  ngOnDestroy(): void {
    this.heatMap?.remove();
    this.heatMap = null;
  }

  // ─── Caricamento sezione operativa (pre-esistente) ───────────────────────────

  async loadOperational(): Promise<void> {
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

  // ─── Caricamento sezioni analytics (indipendenti) ────────────────────────────

  async loadSummary(): Promise<void> {
    this.loadingSummary.set(true);
    try {
      this.summary.set(await this.analyticsService.getSummary());
    } catch (err) {
      this.showError('Impossibile caricare il riepilogo', err);
    } finally {
      this.loadingSummary.set(false);
    }
  }

  async loadChart(): Promise<void> {
    this.loadingChart.set(true);
    try {
      const res = await this.analyticsService.getCompletionsOverTime({
        from: this.dateFrom(),
        to: this.dateTo(),
        granularity: this.granularity(),
      });
      this.completionsOverTime.set(res.data);
    } catch (err) {
      this.showError('Impossibile caricare il grafico completamenti', err);
    } finally {
      this.loadingChart.set(false);
    }
  }

  async loadHeatmap(): Promise<void> {
    this.loadingHeatmap.set(true);
    try {
      const res = await this.analyticsService.getCompletionsHeatmap({
        from: this.dateFrom(),
        to: this.dateTo(),
      });
      this.updateHeatLayer(res.points);
    } catch (err) {
      this.showError('Impossibile caricare la heatmap', err);
    } finally {
      this.loadingHeatmap.set(false);
    }
  }

  async loadTables(): Promise<void> {
    this.loadingTables.set(true);
    try {
      const [top, never, lb] = await Promise.all([
        this.analyticsService.getTopQuests(10),
        this.analyticsService.getNeverCompletedQuests(),
        this.analyticsService.getLeaderboard(20),
      ]);
      this.topQuests.set(top);
      this.neverCompleted.set(never);
      this.leaderboard.set(lb);
    } catch (err) {
      this.showError('Impossibile caricare le classifiche', err);
    } finally {
      this.loadingTables.set(false);
    }
  }

  onGranularityChange(g: AnalyticsGranularity): void {
    this.granularity.set(g);
    void this.loadChart();
  }

  goTo(url: string): void {
    void this.router.navigateByUrl(url);
  }

  questTypeBadgeClass(type: QuestType): string {
    return type === QuestType.PRIMARY ? 'tq-badge tq-badge--green' : 'tq-badge tq-badge--gray';
  }

  questTypeLabel(type: QuestType): string {
    return type === QuestType.PRIMARY ? '★ Principale' : '● Secondaria';
  }

  // ─── Heatmap helpers ─────────────────────────────────────────────────────────

  private initHeatmap(): void {
    const container = this.heatmapDivRef?.nativeElement;
    if (!container || this.heatMap) return;
    applyLeafletIconFix();
    this.heatMap = L.map(container).setView(TRENTINO_CENTER, TRENTINO_ZOOM);
    createOsmTileLayer().addTo(this.heatMap);
  }

  private updateHeatLayer(points: CompletionsHeatmapPoint[]): void {
    if (!this.heatMap) return;
    if (this.heatLyr) {
      this.heatMap.removeLayer(this.heatLyr);
      this.heatLyr = null;
    }
    if (points.length === 0) return;
    const latlngs = points.map((p) => [p.lat, p.lng] as [number, number]);
    this.heatLyr = (L as LeafletWithHeat)
      .heatLayer(latlngs, { radius: 25, blur: 15, maxZoom: 17 })
      .addTo(this.heatMap);
  }

  // ─── Utilita' date ───────────────────────────────────────────────────────────

  private dateFrom(): string {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  }

  private dateTo(): string {
    return new Date().toISOString().split('T')[0];
  }

  private formatChartLabel(isoDate: string): string {
    const d = new Date(isoDate);
    const g = this.granularity();
    if (g === AnalyticsGranularity.MONTH) {
      return d.toLocaleDateString('it-IT', { month: 'short', year: '2-digit' });
    }
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
  }

  // ─── Errori ──────────────────────────────────────────────────────────────────

  private showError(prefix: string, err: unknown): void {
    let detail = 'Errore sconosciuto';
    if (err instanceof HttpErrorResponse) {
      detail = err.error?.message ?? `HTTP ${err.status}`;
    }
    this.snackBar.open(`${prefix}: ${detail}`, 'Chiudi', { duration: 5000 });
  }
}
