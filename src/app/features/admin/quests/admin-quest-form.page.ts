import { Component, computed, inject, signal, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import {
  AnyQuest,
  Collectible,
  CreatePrimaryQuestRequest,
  CreateSecondaryQuestRequest,
  PrimaryQuest,
  SecondaryQuest,
  UpdateQuestRequest,
} from '@trentino-quest/shared-types';
import { CollectibleRarity, QuestType } from '@trentino-quest/shared-types';
import { QuestsAdminService } from '../../../core/services/quests-admin.service';
import { CollectiblesAdminService } from '../../../core/services/collectibles-admin.service';
import { BreadcrumbService } from '../../../core/services/breadcrumb.service';
import { GeocodingService, GeocodingResult } from '../../../core/services/geocoding.service';
import {
  MapPickerValue,
  QuestMapPickerComponent,
} from '../../../shared/components/quest-map-picker/quest-map-picker.component';
import { TqSliderComponent } from '../../../shared/components/tq-slider/tq-slider.component';
import { ToggleSwitchComponent } from '../../../shared/components/toggle-switch/toggle-switch.component';

/** Limiti raggio per tipo quest, coerenti con gli slider e le guard backend. */
const RADIUS_LIMITS: Record<QuestType, { min: number; max: number; def: number }> = {
  [QuestType.PRIMARY]: { min: 10, max: 60, def: 25 },
  [QuestType.SECONDARY]: { min: 5, max: 20, def: 15 },
};

@Component({
  selector: 'app-admin-quest-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    QuestMapPickerComponent,
    TqSliderComponent,
    ToggleSwitchComponent,
  ],
  templateUrl: './admin-quest-form.page.html',
  styleUrl: './admin-quest-form.page.scss',
})
export class AdminQuestFormPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly questsService = inject(QuestsAdminService);
  private readonly collectiblesService = inject(CollectiblesAdminService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly breadcrumb = inject(BreadcrumbService);
  private readonly geocoding = inject(GeocodingService);

  @ViewChild(QuestMapPickerComponent) private mapPicker?: QuestMapPickerComponent;

  readonly QuestType = QuestType;
  readonly CollectibleRarity = CollectibleRarity;

  readonly questId = signal<string | null>(null);
  readonly isEdit = computed(() => this.questId() !== null);
  readonly isLoading = signal(false);
  readonly isSubmitting = signal(false);
  readonly collectibles = signal<Collectible[]>([]);

  readonly showInlineCollectibleForm = signal(false);
  readonly isCreatingCollectible = signal(false);
  readonly activateOnCreate = signal(false);

  readonly form = this.fb.nonNullable.group({
    type: [QuestType.PRIMARY, Validators.required],
    name: ['', [Validators.required, Validators.minLength(3)]],
    description: ['', Validators.required],
    points: [100, [Validators.required, Validators.min(10), Validators.max(500)]],
    collectibleId: [null as string | null],
    locationValue: [null as MapPickerValue | null, Validators.required],
    radiusMeters: [25, Validators.required],
  });

  readonly inlineCollectibleForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    description: ['', Validators.required],
    imageUrl: ['', Validators.required],
    rarity: [CollectibleRarity.COMMON, Validators.required],
    lore: ['' as string],
    locationValue: [null as MapPickerValue | null],
  });

  readonly samePositionAsQuest = signal(false);

  readonly rarityOptions = [
    { value: CollectibleRarity.COMMON, label: 'Comune' },
    { value: CollectibleRarity.UNCOMMON, label: 'Non comune' },
    { value: CollectibleRarity.RARE, label: 'Raro' },
    { value: CollectibleRarity.LEGENDARY, label: 'Leggendario' },
  ];

  /** Valore sentinella dell'opzione "Crea nuovo" nel select collezionabile. */
  readonly CREATE_SENTINEL = '__create__';

  rarityLabel(r: CollectibleRarity): string {
    return this.rarityOptions.find((o) => o.value === r)?.label ?? r;
  }

  /** Classe badge per rarità: grigio/verde/ambra crescente. */
  rarityBadgeClass(r: CollectibleRarity): string {
    switch (r) {
      case CollectibleRarity.COMMON:
        return 'tq-badge tq-badge--gray';
      case CollectibleRarity.UNCOMMON:
        return 'tq-badge tq-badge--green';
      case CollectibleRarity.RARE:
      case CollectibleRarity.LEGENDARY:
        return 'tq-badge tq-badge--amber';
    }
  }

  /**
   * Gestisce la scelta nel select collezionabile: se è la sentinella
   * "Crea nuovo", riporta il control a null e apre il form inline.
   */
  onCollectibleSelectionChange(value: string | null): void {
    if (value === this.CREATE_SENTINEL) {
      this.form.controls.collectibleId.setValue(null);
      this.showInlineCollectibleForm.set(true);
    }
  }

  /** Tipo quest corrente come signal reattivo (il value del FormControl non lo è). */
  readonly questType = signal<QuestType>(QuestType.PRIMARY);

  readonly mapSearchQuery = signal('');
  readonly searchResults = signal<GeocodingResult[]>([]);
  readonly isSearching = signal(false);
  private searchDebounce: ReturnType<typeof setTimeout> | null = null;

  /** Limiti raggio per il tipo corrente (pilotano min/max dello slider). */
  readonly radiusMin = computed(() => RADIUS_LIMITS[this.questType()].min);
  readonly radiusMax = computed(() => RADIUS_LIMITS[this.questType()].max);

  /**
   * Cambia il tipo di quest aggiornando form + signal e ri-clampando il
   * raggio nei limiti del nuovo tipo: senza questo, passando da Principale
   * (max 60) a Secondaria (max 20) un valore tipo 25 resterebbe fuori
   * range e farebbe scattare la guard del backend.
   */
  setType(type: QuestType): void {
    this.form.controls.type.setValue(type);
    this.questType.set(type);
    this.applyCollectibleRequirement(type);

    const { min, max } = RADIUS_LIMITS[type];
    const current = this.form.controls.radiusMeters.value;
    const clamped = Math.min(Math.max(current, min), max);
    if (clamped !== current) {
      this.form.controls.radiusMeters.setValue(clamped);
    }
  }

  /**
   * Una quest principale DEVE avere un collezionabile associato (è il
   * premio sbloccato al completamento); una secondaria non ne ha. Applica
   * o rimuove il validator required di conseguenza.
   */
  private applyCollectibleRequirement(type: QuestType): void {
    const ctrl = this.form.controls.collectibleId;
    if (type === QuestType.PRIMARY) {
      ctrl.addValidators(Validators.required);
    } else {
      ctrl.removeValidators(Validators.required);
      ctrl.setValue(null);
    }
    ctrl.updateValueAndValidity();
  }

  /**
   * Reagisce alla digitazione: aggiorna la query e lancia la ricerca con
   * debounce (350ms) così i suggerimenti appaiono mentre si scrive, senza
   * martellare il servizio di geocoding a ogni tasto.
   */
  onSearchInput(value: string): void {
    this.mapSearchQuery.set(value);
    if (this.searchDebounce) {
      clearTimeout(this.searchDebounce);
    }
    if (!value.trim()) {
      this.searchResults.set([]);
      return;
    }
    this.searchDebounce = setTimeout(() => void this.onSearchLocation(), 350);
  }

  /** Esegue la ricerca geografica del luogo digitato. */
  async onSearchLocation(): Promise<void> {
    if (this.searchDebounce) {
      clearTimeout(this.searchDebounce);
      this.searchDebounce = null;
    }
    const q = this.mapSearchQuery().trim();
    if (!q) {
      this.searchResults.set([]);
      return;
    }
    this.isSearching.set(true);
    try {
      this.searchResults.set(await this.geocoding.search(q));
    } catch {
      this.snackBar.open('Errore nella ricerca del luogo', 'OK', { duration: 3000 });
    } finally {
      this.isSearching.set(false);
    }
  }

  /** Seleziona un risultato: posiziona il punto sulla mappa e pulisce la lista. */
  pickSearchResult(r: GeocodingResult): void {
    this.mapPicker?.focusLocation(r.lat, r.lon);
    this.mapSearchQuery.set(r.displayName);
    this.searchResults.set([]);
  }

  /** Id collezionabile selezionato come signal reattivo (il value del control non lo è). */
  private readonly selectedCollectibleId = toSignal(this.form.controls.collectibleId.valueChanges, {
    initialValue: this.form.controls.collectibleId.value,
  });

  readonly selectedCollectible = computed(() => {
    const id = this.selectedCollectibleId();
    if (!id) return null;
    return this.collectibles().find((x) => x.id === id) ?? null;
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    this.questId.set(id);
    this.breadcrumb.set(id ? 'Modifica quest' : 'Nuova quest', true);
    // Tipo di default PRIMARY → collezionabile obbligatorio fin da subito.
    this.applyCollectibleRequirement(this.questType());
    void this.loadCollectibles();
    if (id) void this.loadQuest(id);
  }

  private async loadCollectibles(): Promise<void> {
    try {
      const list = await this.collectiblesService.list();
      this.collectibles.set(list);
    } catch {
      /* silently ignore */
    }
  }

  private async loadQuest(id: string): Promise<void> {
    this.isLoading.set(true);
    try {
      const quest = await this.questsService.getById(id);
      this.patchForm(quest);
    } catch {
      this.snackBar.open('Errore nel caricamento della quest', 'OK', { duration: 3000 });
      void this.router.navigateByUrl('/admin/quests');
    } finally {
      this.isLoading.set(false);
    }
  }

  private patchForm(quest: AnyQuest): void {
    this.questType.set(quest.type);
    this.applyCollectibleRequirement(quest.type);
    this.form.patchValue({
      type: quest.type,
      name: quest.name ?? '',
      description: quest.description ?? '',
      points: quest.basePoints ?? 100,
    });

    if (quest.type === QuestType.PRIMARY) {
      const primary = quest as PrimaryQuest;
      this.form.patchValue({
        collectibleId: primary.collectibleId ?? null,
        radiusMeters: primary.searchRadiusMeters,
        locationValue: {
          lat: primary.searchArea.lat,
          lng: primary.searchArea.lng,
          radius: primary.searchRadiusMeters,
        },
      });
    } else {
      const secondary = quest as SecondaryQuest;
      this.form.patchValue({
        radiusMeters: secondary.checkInRadiusMeters,
        locationValue: {
          lat: secondary.position.lat,
          lng: secondary.position.lng,
          radius: secondary.checkInRadiusMeters,
        },
      });
    }
  }

  onToggleInlineCollectible(): void {
    this.showInlineCollectibleForm.update((v) => !v);
    if (this.showInlineCollectibleForm()) {
      this.form.controls.collectibleId.setValue(null);
    } else {
      this.inlineCollectibleForm.reset({
        name: '',
        description: '',
        imageUrl: '',
        rarity: CollectibleRarity.COMMON,
        lore: '',
        locationValue: null,
      });
      this.samePositionAsQuest.set(false);
    }
  }

  onSamePositionChange(checked: boolean): void {
    this.samePositionAsQuest.set(checked);
    this.inlineCollectibleForm.controls.locationValue.setValue(
      checked ? this.form.controls.locationValue.value : null,
    );
  }

  async onSaveInlineCollectible(): Promise<void> {
    if (this.inlineCollectibleForm.invalid || this.isCreatingCollectible()) {
      this.inlineCollectibleForm.markAllAsTouched();
      return;
    }
    this.isCreatingCollectible.set(true);
    try {
      const { locationValue, lore, ...base } = this.inlineCollectibleForm.getRawValue();
      const created = await this.collectiblesService.create({
        ...base,
        lore: lore || null,
        coordinates: locationValue ? { lat: locationValue.lat, lng: locationValue.lng } : undefined,
      });
      this.collectibles.update((list) => [...list, created]);
      this.form.controls.collectibleId.setValue(created.id);
      this.showInlineCollectibleForm.set(false);
      this.samePositionAsQuest.set(false);
      this.inlineCollectibleForm.reset({
        name: '',
        description: '',
        imageUrl: '',
        rarity: CollectibleRarity.COMMON,
        lore: '',
        locationValue: null,
      });
      this.snackBar.open(`"${created.name}" creato e selezionato`, 'OK', { duration: 3000 });
    } catch {
      this.snackBar.open('Errore nella creazione del collezionabile', 'OK', { duration: 3000 });
    } finally {
      this.isCreatingCollectible.set(false);
    }
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid || this.isSubmitting()) {
      this.form.markAllAsTouched();
      return;
    }
    this.isSubmitting.set(true);
    try {
      if (this.isEdit()) {
        await this.submitUpdate();
        this.snackBar.open('Quest aggiornata', 'OK', { duration: 3000 });
      } else {
        await this.submitCreate();
        this.snackBar.open('Quest creata', 'OK', { duration: 3000 });
      }
      void this.router.navigateByUrl('/admin/quests');
    } catch {
      this.snackBar.open('Errore nel salvataggio', 'OK', { duration: 3000 });
    } finally {
      this.isSubmitting.set(false);
    }
  }

  private async submitCreate(): Promise<void> {
    const v = this.form.getRawValue();
    const loc = v.locationValue!;

    if (v.type === QuestType.PRIMARY) {
      const payload: CreatePrimaryQuestRequest = {
        type: QuestType.PRIMARY,
        name: v.name,
        description: v.description,
        basePoints: v.points,
        searchArea: { lat: loc.lat, lng: loc.lng },
        searchRadiusMeters: v.radiusMeters,
        collectibleId: v.collectibleId || undefined,
      };
      await this.questsService.create(payload);
    } else {
      const payload: CreateSecondaryQuestRequest = {
        type: QuestType.SECONDARY,
        name: v.name,
        description: v.description,
        basePoints: v.points,
        position: { lat: loc.lat, lng: loc.lng },
        checkInRadiusMeters: v.radiusMeters,
      };
      const created = await this.questsService.create(payload);
      if (this.activateOnCreate()) {
        await this.questsService.activate(created.id);
      }
    }
  }

  private async submitUpdate(): Promise<void> {
    const id = this.questId();
    if (!id) return;
    const v = this.form.getRawValue();
    const loc = v.locationValue!;

    const payload: UpdateQuestRequest = {
      name: v.name,
      description: v.description,
      basePoints: v.points,
    };

    if (v.type === QuestType.PRIMARY) {
      payload.searchArea = { lat: loc.lat, lng: loc.lng };
      payload.searchRadiusMeters = v.radiusMeters;
      payload.collectibleId = v.collectibleId || undefined;
    } else {
      payload.position = { lat: loc.lat, lng: loc.lng };
      payload.checkInRadiusMeters = v.radiusMeters;
    }

    await this.questsService.update(id, payload);
  }

  onCancel(): void {
    void this.router.navigateByUrl('/admin/quests');
  }
}
