import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type { Collectible } from '@trentino-quest/shared-types';
import { environment } from '../../../environments/environment';

/**
 * Service per le operazioni admin sui collezionabili.
 *
 * Espone al momento solo la lista, usata dalla form di creazione di
 * una quest principale per popolare il dropdown del collezionabile
 * associato. Sara' esteso con CRUD completo quando il modulo
 * collezionabili del backoffice verra' implementato.
 */
@Injectable({ providedIn: 'root' })
export class CollectiblesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/admin/collectibles`;

  /**
   * Recupera la lista completa dei collezionabili.
   */
  async list(): Promise<Collectible[]> {
    return firstValueFrom(this.http.get<Collectible[]>(this.baseUrl));
  }
}
