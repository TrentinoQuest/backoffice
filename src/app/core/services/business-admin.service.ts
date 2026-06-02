import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type {
  Business,
  ListBusinessesQuery,
  ListBusinessesResponse,
  RejectBusinessRequest,
} from '@trentino-quest/shared-types';
import { environment } from '../../../environments/environment';

/**
 * Service per le operazioni admin sulle affiliazioni delle Attivita Locali.
 *
 * Incapsula le chiamate HTTP verso gli endpoint /admin/businesses del
 * backend (interfaccia IBusinessAdmin, RF38). Coerente con gli altri
 * service admin: metodi Promise-based.
 */
@Injectable({ providedIn: 'root' })
export class BusinessAdminService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/admin/businesses`;

  /**
   * Recupera la lista paginata delle attivita, opzionalmente filtrata
   * per stato di approvazione.
   */
  async list(query: ListBusinessesQuery): Promise<ListBusinessesResponse> {
    let params = new HttpParams();
    if (query.approvalStatus !== undefined) {
      params = params.set('approvalStatus', query.approvalStatus);
    }
    if (query.limit !== undefined) {
      params = params.set('limit', String(query.limit));
    }
    if (query.offset !== undefined) {
      params = params.set('offset', String(query.offset));
    }
    return firstValueFrom(this.http.get<ListBusinessesResponse>(this.baseUrl, { params }));
  }

  /**
   * Approva l'affiliazione di un'attivita.
   */
  async approve(id: string): Promise<Business> {
    return firstValueFrom(this.http.post<Business>(`${this.baseUrl}/${id}/approve`, {}));
  }

  /**
   * Rifiuta l'affiliazione di un'attivita, con motivazione opzionale.
   */
  async reject(id: string, payload: RejectBusinessRequest = {}): Promise<Business> {
    return firstValueFrom(this.http.post<Business>(`${this.baseUrl}/${id}/reject`, payload));
  }
}
