import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type {
  ListOperatorQuestsQuery,
  ListOperatorQuestsResponse,
  OperatorQuestView,
  PlaceQuestRequest,
  ReportQuestIssueRequest,
  UpdateQuestPositionRequest,
} from '@trentino-quest/shared-types';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class OperatorService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/operator/quests`;

  async list(query: ListOperatorQuestsQuery): Promise<ListOperatorQuestsResponse> {
    let params = new HttpParams();
    if (query.placementStatus !== undefined) {
      params = params.set('placementStatus', query.placementStatus);
    }
    if (query.limit !== undefined) {
      params = params.set('limit', String(query.limit));
    }
    if (query.offset !== undefined) {
      params = params.set('offset', String(query.offset));
    }
    return firstValueFrom(this.http.get<ListOperatorQuestsResponse>(this.baseUrl, { params }));
  }

  async getById(id: string): Promise<OperatorQuestView> {
    return firstValueFrom(this.http.get<OperatorQuestView>(`${this.baseUrl}/${id}`));
  }

  async place(id: string, payload: PlaceQuestRequest): Promise<OperatorQuestView> {
    return firstValueFrom(
      this.http.post<OperatorQuestView>(`${this.baseUrl}/${id}/place`, payload),
    );
  }

  async updatePosition(
    id: string,
    payload: UpdateQuestPositionRequest,
  ): Promise<OperatorQuestView> {
    return firstValueFrom(
      this.http.patch<OperatorQuestView>(`${this.baseUrl}/${id}/position`, payload),
    );
  }

  async reportIssue(id: string, payload: ReportQuestIssueRequest): Promise<void> {
    await firstValueFrom(this.http.post<void>(`${this.baseUrl}/${id}/report-issue`, payload));
  }
}
