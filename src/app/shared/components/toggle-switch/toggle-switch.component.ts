import { Component, forwardRef, input, output, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'app-toggle-switch',
  standalone: true,
  imports: [],
  templateUrl: './toggle-switch.component.html',
  styleUrl: './toggle-switch.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => ToggleSwitchComponent),
      multi: true,
    },
  ],
})
export class ToggleSwitchComponent implements ControlValueAccessor {
  /** Etichetta accessibile (aria-label) */
  readonly ariaLabel = input<string>('');
  /** Uso standalone: stato controllato dall'esterno (opzionale, alternativo a ngModel) */
  readonly checked = input<boolean | null>(null);
  /** Emesso quando l'utente cambia lo stato (uso standalone) */
  readonly checkedChange = output<boolean>();

  /** Stato interno (usato con ControlValueAccessor) */
  readonly state = signal<boolean>(false);
  readonly disabled = signal<boolean>(false);

  private onChange: (v: boolean) => void = () => {};
  private onTouched: () => void = () => {};

  /** Valore effettivo: input controllato se presente, altrimenti stato interno */
  isOn(): boolean {
    const c = this.checked();
    return c === null ? this.state() : c;
  }

  toggle(): void {
    if (this.disabled()) return;
    const next = !this.isOn();
    this.state.set(next);
    this.onChange(next);
    this.onTouched();
    this.checkedChange.emit(next);
  }

  writeValue(v: boolean): void {
    this.state.set(!!v);
  }
  registerOnChange(fn: (v: boolean) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  setDisabledState(d: boolean): void {
    this.disabled.set(d);
  }
}
