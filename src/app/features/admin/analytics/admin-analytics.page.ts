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
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { BaseChartDirective } from 'ng2-charts';
import type { ChartData, ChartOptions } from 'chart.js';
import * as L from 'leaflet';
import 'leaflet.heat';
import {
  AnalyticsGranularity,
  AnalyticsSummary,
  CompletionsHeatmapPoint,
  CompletionsOverTimePoint,
  LeaderboardEntry,
  NeverCompletedQuestEntry,
  QuestType,
  TopQuestEntry,
} from '@trentino-quest/shared-types';
import { AnalyticsService } from '../../../core/services/analytics.service';
import { BreadcrumbService } from '../../../core/services/breadcrumb.service';
import {
  applyLeafletIconFix,
  createOsmTileLayer,
  TRENTINO_CENTER,
  TRENTINO_ZOOM,
} from '../../../shared/leaflet/leaflet-config';

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
  selector: 'app-admin-analytics',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    BaseChartDirective,
  ],
  templateUrl: './admin-analytics.page.html',
  styleUrl: './admin-analytics.page.scss',
})
export class AdminAnalyticsPage implements OnInit, AfterViewInit, OnDestroy {
  private readonly analyticsService = inject(AnalyticsService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly breadcrumb = inject(BreadcrumbService);

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
  readonly dateRangeDays = signal<30 | 90 | 365>(30);

  readonly AnalyticsGranularity = AnalyticsGranularity;
  readonly QuestType = QuestType;

  readonly chartData = computed<ChartData<'bar'>>(() => {
    const points = this.completionsOverTime();
    return {
      labels: points.map((p) => this.formatChartLabel(p.date)),
      datasets: [
        {
          label: 'Completamenti',
          data: points.map((p) => p.count),
          backgroundColor: 'rgba(45, 106, 79, 0.75)',
          borderColor: '#2d6a4f',
          borderWidth: 1,
          borderRadius: 6,
          hoverBackgroundColor: 'rgba(45, 106, 79, 0.95)',
        },
      ],
    };
  });

  readonly chartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        mode: 'index',
        intersect: false,
        callbacks: {
          title: (items) => items[0]?.label ?? '',
          label: (item) => ` ${item.parsed.y} completamento${item.parsed.y !== 1 ? 'i' : ''}`,
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { precision: 0 },
        grid: { color: 'rgba(0,0,0,0.05)' },
        title: { display: true, text: 'Completamenti', font: { size: 11 } },
      },
      x: {
        grid: { display: false },
        ticks: { maxRotation: 45, font: { size: 11 } },
      },
    },
  };

  readonly maxChartValue = computed(() =>
    Math.max(0, ...this.completionsOverTime().map((p) => p.count)),
  );

  readonly avgChartValue = computed(() => {
    const pts = this.completionsOverTime();
    if (pts.length === 0) return 0;
    return Math.round(pts.reduce((s, p) => s + p.count, 0) / pts.length);
  });

  @ViewChild('heatmapDiv') private heatmapDivRef?: ElementRef<HTMLDivElement>;
  private heatMap: L.Map | null = null;
  private heatLyr: L.Layer | null = null;

  ngOnInit(): void {
    this.breadcrumb.set('Analytics');
    void this.loadAll();
  }

  ngAfterViewInit(): void {
    this.initHeatmap();
  }

  ngOnDestroy(): void {
    this.heatMap?.remove();
    this.heatMap = null;
  }

  private async loadAll(): Promise<void> {
    await Promise.all([
      this.loadSummary(),
      this.loadChart(),
      this.loadHeatmap(),
      this.loadTables(),
    ]);
  }

  async loadSummary(): Promise<void> {
    this.loadingSummary.set(true);
    try {
      this.summary.set(await this.analyticsService.getSummary());
    } catch (err) {
      this.showError('Riepilogo', err);
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
      this.showError('Grafico completamenti', err);
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
      this.showError('Heatmap', err);
    } finally {
      this.loadingHeatmap.set(false);
    }
  }

  async loadTables(): Promise<void> {
    this.loadingTables.set(true);
    try {
      const [top, never, lb] = await Promise.all([
        this.analyticsService.getTopQuests(20),
        this.analyticsService.getNeverCompletedQuests(),
        this.analyticsService.getLeaderboard(50),
      ]);
      this.topQuests.set(top);
      this.neverCompleted.set(never);
      this.leaderboard.set(lb);
    } catch (err) {
      this.showError('Classifiche', err);
    } finally {
      this.loadingTables.set(false);
    }
  }

  onGranularityChange(g: AnalyticsGranularity): void {
    this.granularity.set(g);
    void this.loadChart();
  }

  onDateRangeChange(days: 30 | 90 | 365): void {
    this.dateRangeDays.set(days);
    void this.loadChart();
    void this.loadHeatmap();
  }

  questTypeBadgeClass(type: QuestType): string {
    return type === QuestType.PRIMARY ? 'tq-badge tq-badge--green' : 'tq-badge tq-badge--gray';
  }

  questTypeLabel(type: QuestType): string {
    return type === QuestType.PRIMARY ? '★ Principale' : '● Secondaria';
  }

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
      .heatLayer(latlngs, {
        radius: 28,
        blur: 18,
        maxZoom: 17,
        gradient: { 0.2: '#52d68a', 0.5: '#f4701b', 1.0: '#e53e3e' },
      })
      .addTo(this.heatMap);
  }

  private dateFrom(): string {
    const d = new Date();
    d.setDate(d.getDate() - this.dateRangeDays());
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

  private showError(prefix: string, err: unknown): void {
    let detail = 'Errore sconosciuto';
    if (err instanceof HttpErrorResponse) {
      detail = err.error?.message ?? `HTTP ${err.status}`;
    }
    this.snackBar.open(`${prefix}: ${detail}`, 'Chiudi', { duration: 5000 });
  }
}
