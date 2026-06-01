import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { CollectibleRarity } from '@trentino-quest/shared-types';
import { CollectiblesAdminService } from '../../../core/services/collectibles-admin.service';
import { BreadcrumbService } from '../../../core/services/breadcrumb.service';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-admin-collectible-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatSnackBarModule],
  templateUrl: './admin-collectible-form.page.html',
  styleUrl: './admin-collectible-form.page.scss',
})
export class AdminCollectibleFormPage implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(CollectiblesAdminService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly breadcrumb = inject(BreadcrumbService);

  readonly collectibleId = signal<string | null>(null);
  readonly isLoading = signal(false);
  readonly isSaving = signal(false);

  readonly CollectibleRarity = CollectibleRarity;
  readonly rarityOptions: { value: CollectibleRarity; label: string }[] = [
    { value: CollectibleRarity.COMMON, label: 'Comune' },
    { value: CollectibleRarity.UNCOMMON, label: 'Non comune' },
    { value: CollectibleRarity.RARE, label: 'Raro' },
    { value: CollectibleRarity.LEGENDARY, label: 'Leggendario' },
  ];

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
    description: ['', [Validators.required, Validators.maxLength(500)]],
    imageUrl: ['', [Validators.required]],
    rarity: [CollectibleRarity.COMMON, [Validators.required]],
  });

  /** Anteprima live dell'URL immagine */
  private readonly imageUrlValue = toSignal(this.form.controls.imageUrl.valueChanges, {
    initialValue: this.form.controls.imageUrl.value,
  });
  readonly previewUrl = computed(() => this.imageUrlValue()?.trim() || '');
  private readonly rarityValue = toSignal(this.form.controls.rarity.valueChanges, {
    initialValue: this.form.controls.rarity.value,
  });

  get isEditMode(): boolean {
    return this.collectibleId() !== null;
  }

  selectedRarity(): CollectibleRarity {
    return this.rarityValue() ?? CollectibleRarity.COMMON;
  }

  ngOnInit(): void {
    this.breadcrumb.set('Collezionabili', true);
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.collectibleId.set(id);
      void this.loadCollectible(id);
    }
  }

  ngOnDestroy(): void {
    this.breadcrumb.set('', false);
  }

  async loadCollectible(id: string): Promise<void> {
    this.isLoading.set(true);
    try {
      const c = await this.service.getById(id);
      this.form.patchValue({
        name: c.name,
        description: c.description,
        imageUrl: c.imageUrl,
        rarity: c.rarity,
      });
    } catch (err) {
      this.showError('Errore nel caricamento del collezionabile', err);
      void this.router.navigateByUrl('/admin/collectibles');
    } finally {
      this.isLoading.set(false);
    }
  }

  setRarity(r: CollectibleRarity): void {
    this.form.controls.rarity.setValue(r);
  }

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
        await this.service.update(id, value);
        this.snackBar.open('Collezionabile aggiornato', 'OK', { duration: 3000 });
      } else {
        await this.service.create(value);
        this.snackBar.open('Collezionabile creato', 'OK', { duration: 3000 });
      }
      void this.router.navigateByUrl('/admin/collectibles');
    } catch (err) {
      this.showError('Errore nel salvataggio', err);
    } finally {
      this.isSaving.set(false);
    }
  }

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
