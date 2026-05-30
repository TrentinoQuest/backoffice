import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { CollectibleRarity } from '@trentino-quest/shared-types';
import { CollectiblesAdminService } from '../../../core/services/collectibles-admin.service';

/**
 * Pagina di creazione e modifica di un collezionabile.
 *
 * Un singolo componente serve entrambi i flussi, distinti dalla presenza
 * del parametro :id nella route. In modalita' modifica i campi vengono
 * precaricati dal backend.
 */
@Component({
  selector: 'app-admin-collectible-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
  ],
  templateUrl: './admin-collectible-form.page.html',
  styleUrl: './admin-collectible-form.page.scss',
})
export class AdminCollectibleFormPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly collectiblesService = inject(CollectiblesAdminService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  /**
   * Id del collezionabile in modifica, null in creazione.
   */
  readonly collectibleId = signal<string | null>(null);
  readonly isLoading = signal(false);
  readonly isSaving = signal(false);

  /**
   * Opzioni di rarita' per il select, derivate dall'enum di shared-types.
   */
  readonly rarityOptions: { value: CollectibleRarity; label: string }[] = [
    { value: CollectibleRarity.COMMON, label: 'Comune' },
    { value: CollectibleRarity.UNCOMMON, label: 'Non comune' },
    { value: CollectibleRarity.RARE, label: 'Raro' },
    { value: CollectibleRarity.LEGENDARY, label: 'Leggendario' },
  ];

  /**
   * Form reattivo del collezionabile.
   */
  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
    description: ['', [Validators.required, Validators.maxLength(500)]],
    imageUrl: ['', [Validators.required]],
    rarity: [CollectibleRarity.COMMON, [Validators.required]],
  });

  get isEditMode(): boolean {
    return this.collectibleId() !== null;
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.collectibleId.set(id);
      void this.loadCollectible(id);
    }
  }

  /**
   * Carica un collezionabile esistente e popola il form.
   */
  async loadCollectible(id: string): Promise<void> {
    this.isLoading.set(true);
    try {
      const collectible = await this.collectiblesService.getById(id);
      this.form.patchValue({
        name: collectible.name,
        description: collectible.description,
        imageUrl: collectible.imageUrl,
        rarity: collectible.rarity,
      });
    } catch (err) {
      this.showError('Errore nel caricamento del collezionabile', err);
      void this.router.navigateByUrl('/admin/collectibles');
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Salva il collezionabile: crea o aggiorna in base alla modalita'.
   */
  async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSaving.set(true);
    const value = this.form.getRawValue();

    try {
      const id = this.collectibleId();
      if (id) {
        await this.collectiblesService.update(id, value);
        this.snackBar.open('Collezionabile aggiornato', 'OK', { duration: 3000 });
      } else {
        await this.collectiblesService.create(value);
        this.snackBar.open('Collezionabile creato', 'OK', { duration: 3000 });
      }
      void this.router.navigateByUrl('/admin/collectibles');
    } catch (err) {
      this.showError('Errore nel salvataggio', err);
    } finally {
      this.isSaving.set(false);
    }
  }

  /**
   * Annulla e torna alla lista.
   */
  onCancel(): void {
    void this.router.navigateByUrl('/admin/collectibles');
  }

  private showError(prefix: string, err: unknown): void {
    let detail = 'Errore sconosciuto';
    if (err instanceof HttpErrorResponse) {
      detail = err.error?.message ?? `HTTP ${err.status}`;
    }
    this.snackBar.open(`${prefix}: ${detail}`, 'Chiudi', { duration: 5000 });
  }
}
