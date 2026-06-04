import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type {
  AnalyticsSummary,
  AnalyticsRangeQuery,
  CompletionsOverTimeQuery,
  CompletionsOverTimeResponse,
  TopQuestEntry,
  NeverCompletedQuestEntry,
  CompletionsHeatmapResponse,
  LeaderboardEntry,
} from '@trentino-quest/shared-types';
import { environment } from '../../../environments/environment';

/**
 * Service per la lettura dei dati analytics del backoffice.
 *
 * Espone i 6 endpoint analytics del backend come metodi Promise-based,
 * seguendo lo stesso pattern degli altri service admin (QuestsAdminService,
 * CollectiblesAdminService, BusinessAdminService). I parametri opzionali
 * vengono passati come HttpParams solo se definiti, lasciando al backend
 * i default (es. ultimi 30 giorni, top 10 quest, limit 50 leaderboard).
 */
@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/admin/analytics`;

  /** Contatori globali del sistema (giocatori, quest, completamenti, ecc.). */
  async getSummary(): Promise<AnalyticsSummary> {
    return firstValueFrom(this.http.get<AnalyticsSummary>(`${this.baseUrl}/summary`));
  }

  /** Serie temporale dei completamenti con granularita' e range opzionali. */
  async getCompletionsOverTime(
    query?: CompletionsOverTimeQuery,
  ): Promise<CompletionsOverTimeResponse> {
    let params = new HttpParams();
    if (query?.from !== undefined) params = params.set('from', query.from);
    if (query?.to !== undefined) params = params.set('to', query.to);
    if (query?.granularity !== undefined) params = params.set('granularity', query.granularity);
    return firstValueFrom(
      this.http.get<CompletionsOverTimeResponse>(`${this.baseUrl}/completions-over-time`, {
        params,
      }),
    );
  }

  /** Classifica delle quest piu' completate. */
  async getTopQuests(limit?: number): Promise<TopQuestEntry[]> {
    let params = new HttpParams();
    if (limit !== undefined) params = params.set('limit', String(limit));
    return firstValueFrom(this.http.get<TopQuestEntry[]>(`${this.baseUrl}/top-quests`, { params }));
  }

  /** Quest attive mai completate da nessun giocatore (zone ignorate). */
  async getNeverCompletedQuests(): Promise<NeverCompletedQuestEntry[]> {
    return firstValueFrom(
      this.http.get<NeverCompletedQuestEntry[]>(`${this.baseUrl}/never-completed-quests`),
    );
  }

  /** Punti GPS dei completamenti per la heatmap dei flussi turistici. */
  async getCompletionsHeatmap(query?: AnalyticsRangeQuery): Promise<CompletionsHeatmapResponse> {
    let params = new HttpParams();
    if (query?.from !== undefined) params = params.set('from', query.from);
    if (query?.to !== undefined) params = params.set('to', query.to);
    return firstValueFrom(
      this.http.get<CompletionsHeatmapResponse>(`${this.baseUrl}/completions-heatmap`, { params }),
    );
  }

  /** Classifica giocatori per punti totali. */
  async getLeaderboard(limit?: number): Promise<LeaderboardEntry[]> {
    let params = new HttpParams();
    if (limit !== undefined) params = params.set('limit', String(limit));
    return firstValueFrom(
      this.http.get<LeaderboardEntry[]>(`${this.baseUrl}/leaderboard`, { params }),
    );
  }
}
