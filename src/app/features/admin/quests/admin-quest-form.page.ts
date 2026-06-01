import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
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
import { CollectibleRarity, QuestStatus, QuestType } from '@trentino-quest/shared-types';
import { QuestsAdminService } from '../../../core/services/quests-admin.service';
import { CollectiblesAdminService } from '../../../core/services/collectibles-admin.service';
import { BreadcrumbService } from '../../../core/services/breadcrumb.service';
import {
  MapPickerValue,
  QuestMapPickerComponent,
} from '../../../shared/components/quest-map-picker/quest-map-picker.component';
import { TqSliderComponent } from '../../../shared/components/tq-slider/tq-slider.component';

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

  readonly QuestType = QuestType;
  readonly QuestStatus = QuestStatus;
  readonly CollectibleRarity = CollectibleRarity;

  readonly questId = signal<string | null>(null);
  readonly isEdit = computed(() => this.questId() !== null);
  readonly isLoading = signal(false);
  readonly isSubmitting = signal(false);
  readonly collectibles = signal<Collectible[]>([]);

  readonly showInlineCollectibleForm = signal(false);
  readonly isCreatingCollectible = signal(false);

  readonly form = this.fb.nonNullable.group({
    type: [QuestType.PRIMARY, Validators.required],
    name: ['', [Validators.required, Validators.minLength(3)]],
    description: ['', Validators.required],
    points: [100, [Validators.required, Validators.min(10), Validators.max(500)]],
    status: [QuestStatus.ACTIVE, Validators.required],
    collectibleId: [null as string | null],
    locationValue: [null as MapPickerValue | null, Validators.required],
    radiusMeters: [25, Validators.required],
  });

  readonly inlineCollectibleForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    description: ['', Validators.required],
    imageUrl: ['', Validators.required],
    rarity: [CollectibleRarity.COMMON, Validators.required],
  });

  readonly rarityOptions = [
    { value: CollectibleRarity.COMMON, label: 'Comune' },
    { value: CollectibleRarity.UNCOMMON, label: 'Non comune' },
    { value: CollectibleRarity.RARE, label: 'Raro' },
    { value: CollectibleRarity.LEGENDARY, label: 'Leggendario' },
  ];

  /** Tipo quest corrente come signal reattivo (il value del FormControl non lo è). */
  readonly questType = signal<QuestType>(QuestType.PRIMARY);

  readonly mapSearchQuery = signal('');

  /** Cambia il tipo di quest aggiornando sia il form che il signal reattivo. */
  setType(type: QuestType): void {
    this.form.controls.type.setValue(type);
    this.questType.set(type);
  }

  readonly selectedCollectibleImage = computed(() => {
    const id = this.form.controls.collectibleId.value;
    if (!id) return '';
    const c = this.collectibles().find((x) => x.id === id);
    return c?.imageUrl ?? '';
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    this.questId.set(id);
    this.breadcrumb.set(id ? 'Modifica quest' : 'Nuova quest', true);
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
    this.form.patchValue({
      type: quest.type,
      name: quest.name ?? '',
      description: quest.description ?? '',
      points: quest.basePoints ?? 100,
      status: quest.status,
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
    if (!this.showInlineCollectibleForm()) {
      this.inlineCollectibleForm.reset({
        name: '',
        description: '',
        imageUrl: '',
        rarity: CollectibleRarity.COMMON,
      });
    }
  }

  async onSaveInlineCollectible(): Promise<void> {
    if (this.inlineCollectibleForm.invalid || this.isCreatingCollectible()) {
      this.inlineCollectibleForm.markAllAsTouched();
      return;
    }
    this.isCreatingCollectible.set(true);
    try {
      const created = await this.collectiblesService.create(
        this.inlineCollectibleForm.getRawValue(),
      );
      this.collectibles.update((list) => [...list, created]);
      this.form.controls.collectibleId.setValue(created.id);
      this.showInlineCollectibleForm.set(false);
      this.inlineCollectibleForm.reset({
        name: '',
        description: '',
        imageUrl: '',
        rarity: CollectibleRarity.COMMON,
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
      await this.questsService.create(payload);
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
