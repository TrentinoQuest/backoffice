import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSliderModule } from '@angular/material/slider';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import type {
  AnyQuest,
  Collectible,
  CreateQuestRequest,
  PrimaryQuest,
  SecondaryQuest,
  UpdateQuestRequest,
} from '@trentino-quest/shared-types';
import { QuestType } from '@trentino-quest/shared-types';
import { QuestsAdminService } from '../../../core/services/quests-admin.service';
import { CollectiblesService } from '../../../core/services/collectibles.service';
import {
  MapPickerValue,
  QuestMapPickerComponent,
} from '../../../shared/components/quest-map-picker/quest-map-picker.component';

/**
 * Pagina di creazione e modifica di una quest dal pannello admin.
 *
 * Lo stesso componente gestisce entrambi i flussi distinguendoli dalla
 * presenza del parametro :id in route:
 * - /admin/quests/new        -> modalita' creazione
 * - /admin/quests/:id/edit   -> modalita' modifica
 *
 * Per le quest principali viene mostrato un dropdown opzionale dei
 * collezionabili associabili; per le secondarie il campo e' nascosto.
 * Il tipo (primary/secondary) non e' modificabile dopo la creazione:
 * cambiare tipo richiederebbe la cancellazione e ricreazione.
 *
 * Il map picker e' integrato come ControlValueAccessor: la sua selezione
 * popola lat/lng nel form, mentre lo slider del raggio aggiorna il
 * cerchio disegnato sulla mappa in tempo reale.
 */
@Component({
  selector: 'app-admin-quest-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSliderModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    QuestMapPickerComponent,
  ],
  templateUrl: './admin-quest-form.page.html',
  styleUrl: './admin-quest-form.page.scss',
})
export class AdminQuestFormPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly questsService = inject(QuestsAdminService);
  private readonly collectiblesService = inject(CollectiblesService);
  private readonly snackBar = inject(MatSnackBar);

  readonly QuestType = QuestType;

  /**
   * Id della quest in modifica, null in modalita' creazione.
   */
  readonly questId = signal<string | null>(null);

  /**
   * Tipo corrente della quest. In modalita' creazione e' modificabile,
   * in modalita' modifica viene letto dalla quest esistente e
   * congelato.
   */
  readonly questType = signal<QuestType>(QuestType.SECONDARY);

  /**
   * Lista dei collezionabili disponibili per il dropdown nelle quest
   * principali. Caricata dal backend all'init del componente.
   */
  readonly collectibles = signal<Collectible[]>([]);

  /**
   * Flag globali di loading e submission per disabilitare l'UI durante
   * le chiamate al backend.
   */
  readonly isLoading = signal(false);
  readonly isSubmitting = signal(false);

  /**
   * Computed che indica se siamo in modalita' modifica.
   */
  readonly isEditMode = computed(() => this.questId() !== null);

  /**
   * Form reactive con tutti i campi possibili. La validazione
   * condizionale (campi presenti solo per primary o solo per secondary)
   * viene gestita disabilitando i campi non applicabili in base al tipo.
   */
  readonly form: FormGroup = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
    description: ['', [Validators.required, Validators.maxLength(1000)]],
    basePoints: [50, [Validators.required, Validators.min(0)]],
    // Comune (popolato dal map picker tramite locationValue)
    locationValue: this.fb.control<MapPickerValue | null>(null, Validators.required),
    radiusMeters: [10, [Validators.required, Validators.min(5)]],
    // Solo primary
    collectibleId: this.fb.control<string | null>(null),
  });

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    this.questId.set(idParam);

    // Carico i collezionabili in parallelo all'eventuale caricamento quest
    void this.loadCollectibles();

    if (idParam) {
      void this.loadQuest(idParam);
    }

    // Sincronizza il raggio dello slider con il map picker:
    // quando l'utente muove lo slider, locationValue cambia il radius
    // riflettendo il nuovo cerchio in mappa.
    this.form.controls['radiusMeters'].valueChanges.subscribe((newRadius: number) => {
      const current = this.form.controls['locationValue'].value as MapPickerValue | null;
      if (current) {
        this.form.controls['locationValue'].setValue(
          { ...current, radius: newRadius },
          { emitEvent: false },
        );
      }
    });
  }

  /**
   * Cambia il tipo di quest (solo in modalita' creazione). Reset dei
   * campi specifici dell'altro tipo per evitare di inviare valori
   * incoerenti al backend.
   */
  onTypeChange(newType: QuestType): void {
    this.questType.set(newType);
    if (newType === QuestType.SECONDARY) {
      this.form.controls['collectibleId'].setValue(null);
    }
  }

  /**
   * Carica i collezionabili per popolare il dropdown.
   */
  private async loadCollectibles(): Promise<void> {
    try {
      const list = await this.collectiblesService.list();
      this.collectibles.set(list);
    } catch (err) {
      this.showError('Errore nel caricamento dei collezionabili', err);
    }
  }

  /**
   * Carica una quest esistente per popolare il form in modalita'
   * modifica.
   */
  private async loadQuest(id: string): Promise<void> {
    this.isLoading.set(true);
    try {
      const quest = await this.questsService.getById(id);
      this.populateForm(quest);
    } catch (err) {
      this.showError('Errore nel caricamento della quest', err);
      await this.router.navigateByUrl('/admin/quests');
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Popola il form con i dati di una quest esistente.
   */
  private populateForm(quest: AnyQuest): void {
    this.questType.set(quest.type);

    if (quest.type === QuestType.PRIMARY) {
      const primary = quest as PrimaryQuest;
      this.form.patchValue({
        name: primary.name,
        description: primary.description,
        basePoints: primary.basePoints,
        radiusMeters: primary.searchRadiusMeters,
        collectibleId: primary.collectibleId ?? null,
        locationValue: {
          lat: primary.searchArea.lat,
          lng: primary.searchArea.lng,
          radius: primary.searchRadiusMeters,
        },
      });
    } else {
      const secondary = quest as SecondaryQuest;
      this.form.patchValue({
        name: secondary.name,
        description: secondary.description,
        basePoints: secondary.basePoints,
        radiusMeters: secondary.checkInRadiusMeters,
        locationValue: {
          lat: secondary.position.lat,
          lng: secondary.position.lng,
          radius: secondary.checkInRadiusMeters,
        },
      });
    }
  }

  /**
   * Submit del form: crea una nuova quest o aggiorna quella esistente.
   */
  async onSubmit(): Promise<void> {
    if (this.form.invalid || this.isSubmitting()) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    try {
      if (this.isEditMode()) {
        await this.update();
      } else {
        await this.create();
      }
    } catch (err) {
      this.showError(this.isEditMode() ? 'Errore nella modifica' : 'Errore nella creazione', err);
    } finally {
      this.isSubmitting.set(false);
    }
  }

  /**
   * Crea una nuova quest costruendo il payload corretto in base al tipo.
   */
  private async create(): Promise<void> {
    const formValue = this.form.getRawValue();
    const location = formValue.locationValue as MapPickerValue;

    let payload: CreateQuestRequest;
    if (this.questType() === QuestType.PRIMARY) {
      payload = {
        type: QuestType.PRIMARY,
        name: formValue.name,
        description: formValue.description,
        basePoints: formValue.basePoints,
        searchArea: { lat: location.lat, lng: location.lng },
        searchRadiusMeters: formValue.radiusMeters,
        collectibleId: formValue.collectibleId ?? null,
      };
    } else {
      payload = {
        type: QuestType.SECONDARY,
        name: formValue.name,
        description: formValue.description,
        basePoints: formValue.basePoints,
        position: { lat: location.lat, lng: location.lng },
        checkInRadiusMeters: formValue.radiusMeters,
      };
    }

    await this.questsService.create(payload);
    this.snackBar.open('Quest creata correttamente', 'OK', { duration: 3000 });
    await this.router.navigateByUrl('/admin/quests');
  }

  /**
   * Aggiorna una quest esistente. Il payload include solo i campi
   * applicabili al tipo della quest in modifica (no cambio di tipo).
   */
  private async update(): Promise<void> {
    const id = this.questId();
    if (!id) return;

    const formValue = this.form.getRawValue();
    const location = formValue.locationValue as MapPickerValue;

    let payload: UpdateQuestRequest;
    if (this.questType() === QuestType.PRIMARY) {
      payload = {
        name: formValue.name,
        description: formValue.description,
        basePoints: formValue.basePoints,
        searchArea: { lat: location.lat, lng: location.lng },
        searchRadiusMeters: formValue.radiusMeters,
        collectibleId: formValue.collectibleId ?? null,
      };
    } else {
      payload = {
        name: formValue.name,
        description: formValue.description,
        basePoints: formValue.basePoints,
        position: { lat: location.lat, lng: location.lng },
        checkInRadiusMeters: formValue.radiusMeters,
      };
    }

    await this.questsService.update(id, payload);
    this.snackBar.open('Quest aggiornata correttamente', 'OK', { duration: 3000 });
    await this.router.navigateByUrl('/admin/quests');
  }

  private showError(prefix: string, err: unknown): void {
    let detail = 'Errore sconosciuto';
    if (err instanceof HttpErrorResponse) {
      detail = (err.error as { message?: string })?.message ?? `HTTP ${err.status}`;
    }
    this.snackBar.open(`${prefix}: ${detail}`, 'Chiudi', { duration: 5000 });
  }
}
