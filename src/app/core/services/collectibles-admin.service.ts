import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type {
  Collectible,
  CreateCollectibleRequest,
  UpdateCollectibleRequest,
} from '@trentino-quest/shared-types';
import { environment } from '../../../environments/environment';

/**
 * Service per le operazioni admin sui collezionabili.
 *
 * Incapsula le chiamate HTTP verso gli endpoint /admin/collectibles del
 * backend. Tutti i metodi ritornano Promise per l'uso con async/await
 * nei componenti, coerentemente con QuestsAdminService.
 */
@Injectable({ providedIn: 'root' })
export class CollectiblesAdminService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/admin/collectibles`;

  /**
   * Recupera la lista completa dei collezionabili.
   */
  async list(): Promise<Collectible[]> {
    return firstValueFrom(this.http.get<Collectible[]>(this.baseUrl));
  }

  /**
   * Recupera il dettaglio di un collezionabile per id.
   */
  async getById(id: string): Promise<Collectible> {
    return firstValueFrom(this.http.get<Collectible>(`${this.baseUrl}/${id}`));
  }

  /**
   * Crea un nuovo collezionabile.
   */
  async create(payload: CreateCollectibleRequest): Promise<Collectible> {
    return firstValueFrom(this.http.post<Collectible>(this.baseUrl, payload));
  }

  /**
   * Aggiorna i campi specificati di un collezionabile.
   */
  async update(id: string, payload: UpdateCollectibleRequest): Promise<Collectible> {
    return firstValueFrom(this.http.patch<Collectible>(`${this.baseUrl}/${id}`, payload));
  }

  /**
   * Archivia un collezionabile (soft delete).
   */
  async archive(id: string): Promise<void> {
    await firstValueFrom(this.http.delete<void>(`${this.baseUrl}/${id}`));
  }
}
