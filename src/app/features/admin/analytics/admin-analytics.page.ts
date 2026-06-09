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
import { downloadCsv, downloadJson, exportDateStamp } from '../../../shared/utils/data-export';

/** Cluster geografico di completamenti, aggregato su griglia lato client. */
interface FlowZone {
  /** Chiave griglia (lat/lng arrotondati). */
  id: string;
  /** Centroide del cluster. */
  lat: number;
  lng: number;
  count: number;
  /** Quota percentuale sul totale dei punti geolocalizzati. */
  share: number;
}

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
  readonly heatmapPoints = signal<CompletionsHeatmapPoint[]>([]);

  /** Lato della cella di griglia per il clustering delle zone (~1.5 km). */
  private static readonly ZONE_GRID = 0.02;

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

  // ─── Analisi flussi turistici (derivata dai punti heatmap) ───────────────

  /** Numero di completamenti con coordinate GPS nel periodo. */
  readonly geoTotal = computed(() => this.heatmapPoints().length);

  /** Cluster geografici ordinati per densita' decrescente. */
  readonly flowZones = computed<FlowZone[]>(() => {
    const points = this.heatmapPoints();
    const total = points.length;
    if (total === 0) return [];
    const grid = AdminAnalyticsPage.ZONE_GRID;
    const buckets = new Map<string, { latSum: number; lngSum: number; count: number }>();
    for (const p of points) {
      const gLat = Math.round(p.lat / grid) * grid;
      const gLng = Math.round(p.lng / grid) * grid;
      const key = `${gLat.toFixed(3)}|${gLng.toFixed(3)}`;
      const b = buckets.get(key);
      if (b) {
        b.latSum += p.lat;
        b.lngSum += p.lng;
        b.count += 1;
      } else {
        buckets.set(key, { latSum: p.lat, lngSum: p.lng, count: 1 });
      }
    }
    return [...buckets.entries()]
      .map(([id, b]) => ({
        id,
        lat: b.latSum / b.count,
        lng: b.lngSum / b.count,
        count: b.count,
        share: (b.count / total) * 100,
      }))
      .sort((a, b) => b.count - a.count);
  });

  /** Numero di zone distinte individuate. */
  readonly zoneCount = computed(() => this.flowZones().length);

  /** Zona piu' frequentata (o null se nessun dato). */
  readonly busiestZone = computed<FlowZone | null>(() => this.flowZones()[0] ?? null);

  /** Conteggio massimo tra le zone, per dimensionare le mini-barre. */
  readonly maxZoneCount = computed(() => Math.max(1, ...this.flowZones().map((z) => z.count)));

  /** Distribuzione dei completamenti per fascia oraria (0-23). */
  readonly hourBuckets = computed<number[]>(() => {
    const buckets = new Array<number>(24).fill(0);
    for (const p of this.heatmapPoints()) {
      const h = new Date(p.completedAt).getHours();
      if (h >= 0 && h < 24) buckets[h] += 1;
    }
    return buckets;
  });

  /** Distribuzione dei completamenti per giorno della settimana (lun-dom). */
  readonly weekdayBuckets = computed<number[]>(() => {
    // Indice 0 = lunedi', 6 = domenica (getDay() restituisce 0 = domenica).
    const buckets = new Array<number>(7).fill(0);
    for (const p of this.heatmapPoints()) {
      const d = new Date(p.completedAt).getDay();
      buckets[(d + 6) % 7] += 1;
    }
    return buckets;
  });

  /** Fascia oraria con piu' completamenti (etichetta "14:00"), o null. */
  readonly peakHour = computed<string | null>(() => {
    const buckets = this.hourBuckets();
    const max = Math.max(...buckets);
    if (max === 0) return null;
    const h = buckets.indexOf(max);
    return `${String(h).padStart(2, '0')}:00`;
  });

  private static readonly WEEKDAY_LABELS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

  readonly hourChartData = computed<ChartData<'bar'>>(() => ({
    labels: Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, '0')}`),
    datasets: [
      {
        label: 'Completamenti',
        data: this.hourBuckets(),
        backgroundColor: 'rgba(37, 99, 235, 0.7)',
        borderColor: '#2563eb',
        borderWidth: 1,
        borderRadius: 4,
      },
    ],
  }));

  readonly weekdayChartData = computed<ChartData<'bar'>>(() => ({
    labels: [...AdminAnalyticsPage.WEEKDAY_LABELS],
    datasets: [
      {
        label: 'Completamenti',
        data: this.weekdayBuckets(),
        backgroundColor: 'rgba(244, 112, 27, 0.7)',
        borderColor: '#f4701b',
        borderWidth: 1,
        borderRadius: 4,
      },
    ],
  }));

  readonly distributionChartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (item) => ` ${item.parsed.y} completamento${item.parsed.y !== 1 ? 'i' : ''}`,
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { precision: 0 },
        grid: { color: 'rgba(0,0,0,0.05)' },
      },
      x: { grid: { display: false }, ticks: { font: { size: 10 } } },
    },
  };

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
      this.heatmapPoints.set(res.points);
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

  // ─── Esportazione dati ────────────────────────────────────────────────────

  private periodSuffix(): string {
    return `${this.dateRangeDays()}g_${exportDateStamp()}`;
  }

  exportCompletionsCsv(): void {
    downloadCsv(
      `completamenti-nel-tempo_${this.granularity()}_${this.periodSuffix()}.csv`,
      [
        { header: 'Periodo', value: (p) => p.date },
        { header: 'Completamenti', value: (p) => p.count },
      ],
      this.completionsOverTime(),
    );
  }

  exportTopQuestsCsv(): void {
    downloadCsv(
      `top-quest_${this.periodSuffix()}.csv`,
      [
        { header: 'Quest ID', value: (q) => q.questId },
        { header: 'Nome', value: (q) => q.name },
        {
          header: 'Tipo',
          value: (q) => (q.type === QuestType.PRIMARY ? 'Principale' : 'Secondaria'),
        },
        { header: 'Completamenti', value: (q) => q.completionCount },
      ],
      this.topQuests(),
    );
  }

  exportNeverCompletedCsv(): void {
    downloadCsv(
      `zone-ignorate_${this.periodSuffix()}.csv`,
      [
        { header: 'Quest ID', value: (q) => q.questId },
        { header: 'Nome', value: (q) => q.name },
        {
          header: 'Tipo',
          value: (q) => (q.type === QuestType.PRIMARY ? 'Principale' : 'Secondaria'),
        },
        { header: 'Creata il', value: (q) => q.createdAt },
      ],
      this.neverCompleted(),
    );
  }

  exportLeaderboardCsv(): void {
    downloadCsv(
      `classifica-giocatori_${this.periodSuffix()}.csv`,
      [
        { header: 'Posizione', value: (e) => this.leaderboard().indexOf(e) + 1 },
        { header: 'Player ID', value: (e) => e.playerId },
        { header: 'Username', value: (e) => e.username },
        { header: 'Monete', value: (e) => e.totalPoints },
      ],
      this.leaderboard(),
    );
  }

  exportFlowZonesCsv(): void {
    downloadCsv(
      `aree-frequentate_${this.periodSuffix()}.csv`,
      [
        { header: 'Posizione', value: (z) => this.flowZones().indexOf(z) + 1 },
        { header: 'Latitudine', value: (z) => z.lat.toFixed(5) },
        { header: 'Longitudine', value: (z) => z.lng.toFixed(5) },
        { header: 'Completamenti', value: (z) => z.count },
        { header: 'Quota %', value: (z) => z.share.toFixed(1) },
      ],
      this.flowZones(),
    );
  }

  exportHeatmapPointsCsv(): void {
    downloadCsv(
      `flussi-grezzi_${this.periodSuffix()}.csv`,
      [
        { header: 'Latitudine', value: (p) => p.lat },
        { header: 'Longitudine', value: (p) => p.lng },
        { header: 'Completato il', value: (p) => p.completedAt },
      ],
      this.heatmapPoints(),
    );
  }

  /** Esporta in un unico file JSON l'intero stato analytics del periodo. */
  exportAllJson(): void {
    downloadJson(`analytics_${this.periodSuffix()}.json`, {
      generatedAt: new Date().toISOString(),
      periodDays: this.dateRangeDays(),
      granularity: this.granularity(),
      summary: this.summary(),
      completionsOverTime: this.completionsOverTime(),
      topQuests: this.topQuests(),
      neverCompletedQuests: this.neverCompleted(),
      leaderboard: this.leaderboard(),
      flowZones: this.flowZones(),
      hourDistribution: this.hourBuckets(),
      weekdayDistribution: this.weekdayBuckets(),
      heatmapPoints: this.heatmapPoints(),
    });
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
