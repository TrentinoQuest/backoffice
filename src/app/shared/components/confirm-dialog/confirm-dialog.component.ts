import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export interface ConfirmDialogData {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <div class="dialog-header" [class.dialog-header--danger]="data.danger">
      <mat-icon class="dialog-icon">{{ data.danger ? 'warning' : 'help_outline' }}</mat-icon>
      <h2 mat-dialog-title class="dialog-title">{{ data.title }}</h2>
    </div>
    <mat-dialog-content>
      <p class="dialog-message">{{ data.message }}</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-stroked-button [mat-dialog-close]="false">
        {{ data.cancelLabel ?? 'Annulla' }}
      </button>
      <button
        mat-flat-button
        [color]="data.danger ? 'warn' : 'primary'"
        [mat-dialog-close]="true"
        cdkFocusInitial
      >
        {{ data.confirmLabel ?? 'Conferma' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .dialog-header {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 1.25rem 1.5rem 0;
      }

      .dialog-icon {
        color: var(--tq-primary);
        font-size: 1.5rem;
        width: 1.5rem;
        height: 1.5rem;
        flex-shrink: 0;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        transform: translateY(12px);
      }

      .dialog-header--danger .dialog-icon {
        color: var(--tq-danger);
      }

      .dialog-title {
        margin: 0;
        font-family: var(--tq-font-display);
        font-size: 1.125rem;
        font-weight: 500;
        color: var(--tq-text);
        display: inline-flex;
        align-items: center;
        transform: translateX(-20px) translateY(15px);
      }

      .dialog-message {
        color: var(--tq-text-muted);
        margin: 0;
        font-size: 0.9375rem;
        line-height: 1.5;
      }

      mat-dialog-actions {
        padding: 0.75rem 1.5rem 1.25rem;
        gap: 0.5rem;
      }
    `,
  ],
})
export class ConfirmDialogComponent {
  readonly data = inject<ConfirmDialogData>(MAT_DIALOG_DATA);
}
