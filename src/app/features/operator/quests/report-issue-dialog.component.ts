import { Component, inject } from '@angular/core';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

export interface ReportIssueDialogData {
  questName: string;
}

export interface ReportIssueDialogResult {
  note?: string;
}

@Component({
  selector: 'app-report-issue-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  template: `
    <div class="dialog-wrap">
      <div class="dialog-header">
        <h2 class="dialog-title">Segnala problema QR</h2>
        <p class="dialog-sub">{{ data.questName }}</p>
      </div>

      <mat-dialog-content>
        <p class="dialog-desc">
          Il QR sarà segnalato come <strong>non funzionante</strong> e dovrà essere ri-piazzato.
          Aggiungi una nota opzionale per descrivere il problema.
        </p>
        <mat-form-field appearance="outline" class="full">
          <mat-label>Nota (opzionale)</mat-label>
          <textarea
            matInput
            [formControl]="form.controls.note"
            rows="3"
            placeholder="es. QR strappato, palo rimosso, codice illeggibile…"
            maxlength="500"
          ></textarea>
          <mat-hint align="end">{{ form.controls.note.value?.length ?? 0 }}/500</mat-hint>
        </mat-form-field>
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button mat-stroked-button type="button" [mat-dialog-close]="undefined">Annulla</button>
        <button mat-flat-button color="warn" type="button" [mat-dialog-close]="result()">
          Segnala problema
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [
    `
      .dialog-wrap {
        min-width: 320px;
        max-width: 480px;
        width: 100%;
      }

      .dialog-header {
        padding: 20px 20px 0;
      }

      .dialog-title {
        font-family: var(--tq-font-display);
        font-size: 1.1rem;
        font-weight: 600;
        color: var(--tq-text);
        margin: 0 0 4px;
      }

      .dialog-sub {
        font-size: 13px;
        color: var(--tq-text-muted);
        margin: 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 360px;
      }

      .dialog-desc {
        font-size: 13.5px;
        color: var(--tq-text-muted);
        line-height: 1.5;
        margin: 0 0 14px;
      }

      mat-dialog-content {
        padding: 16px 20px !important;
      }

      mat-dialog-actions {
        padding: 8px 20px 16px !important;
        gap: 8px;
      }

      .full {
        width: 100%;
      }
    `,
  ],
})
export class ReportIssueDialogComponent {
  readonly data = inject<ReportIssueDialogData>(MAT_DIALOG_DATA);
  private readonly fb = inject(FormBuilder);

  readonly form = this.fb.group({
    note: [''],
  });

  result(): ReportIssueDialogResult {
    const note = this.form.controls.note.value?.trim();
    return note ? { note } : {};
  }
}
