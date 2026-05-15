import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type {
  AnyQuest,
  CreateQuestRequest,
  ListAdminQuestsQuery,
  ListAdminQuestsResponse,
  UpdateQuestRequest,
} from '@trentino-quest/shared-types';
import { environment } from '../../../environments/environment';

/**
 * Service per le operazioni admin sul modulo quests.
 *
 * Incapsula le chiamate HTTP verso gli endpoint /admin/quests del
 * backend, mantenendo il componente pagina libero da preoccupazioni di
 * trasporto. Tutti i metodi ritornano Promise per facilita' d'uso con
 * async/await nei componenti.
 */
@Injectable({ providedIn: 'root' })
export class QuestsAdminService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/admin/quests`;

  /**
   * Recupera la lista paginata delle quest dal backend con eventuali
   * filtri. I parametri non specificati vengono omessi dalla query
   * string, lasciando al backend l'applicazione dei default.
   */
  async list(query: ListAdminQuestsQuery): Promise<ListAdminQuestsResponse> {
    let params = new HttpParams();
    if (query.type !== undefined) {
      params = params.set('type', query.type);
    }
    if (query.status !== undefined) {
      params = params.set('status', query.status);
    }
    if (query.limit !== undefined) {
      params = params.set('limit', String(query.limit));
    }
    if (query.offset !== undefined) {
      params = params.set('offset', String(query.offset));
    }
    return firstValueFrom(this.http.get<ListAdminQuestsResponse>(this.baseUrl, { params }));
  }

  /**
   * Recupera il dettaglio di una quest per id.
   */
  async getById(id: string): Promise<AnyQuest> {
    return firstValueFrom(this.http.get<AnyQuest>(`${this.baseUrl}/${id}`));
  }

  /**
   * Crea una nuova quest (primary o secondary) sul backend.
   */
  async create(payload: CreateQuestRequest): Promise<AnyQuest> {
    return firstValueFrom(this.http.post<AnyQuest>(this.baseUrl, payload));
  }

  /**
   * Aggiorna i campi specificati di una quest esistente.
   */
  async update(id: string, payload: UpdateQuestRequest): Promise<AnyQuest> {
    return firstValueFrom(this.http.patch<AnyQuest>(`${this.baseUrl}/${id}`, payload));
  }

  /**
   * Archivia una quest (soft delete). Il backend imposta status=archived.
   */
  async archive(id: string): Promise<void> {
    await firstValueFrom(this.http.delete<void>(`${this.baseUrl}/${id}`));
  }

  /**
   * Attiva una quest (status -> active).
   */
  async activate(id: string): Promise<AnyQuest> {
    return firstValueFrom(this.http.post<AnyQuest>(`${this.baseUrl}/${id}/activate`, {}));
  }

  /**
   * Disattiva una quest (status -> inactive).
   */
  async deactivate(id: string): Promise<AnyQuest> {
    return firstValueFrom(this.http.post<AnyQuest>(`${this.baseUrl}/${id}/deactivate`, {}));
  }
}
