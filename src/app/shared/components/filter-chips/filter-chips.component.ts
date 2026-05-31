import { Component, input, output, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface FilterChip<T> {
  label: string;
  value: T;
}

export interface FilterGroup<T> {
  chips: FilterChip<T>[];
}

@Component({
  selector: 'app-filter-chips',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './filter-chips.component.html',
  styleUrl: './filter-chips.component.scss',
})
export class FilterChipsComponent<T> {
  /** Gruppi di chip separati da un divisore verticale */
  readonly groups = input.required<FilterGroup<T>[]>();
  /** Valore attualmente selezionato */
  readonly selected = input<T | null>(null);
  /** Emette il valore cliccato */
  readonly selectedChange = output<T | null>();

  isActive(value: T): boolean {
    return this.selected() === value;
  }

  select(value: T): void {
    this.selectedChange.emit(this.selected() === value ? null : value);
  }
}
