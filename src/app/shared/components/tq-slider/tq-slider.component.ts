import {
  Component,
  forwardRef,
  input,
  signal,
  computed,
  HostListener,
  ElementRef,
  ViewChild,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'app-tq-slider',
  standalone: true,
  imports: [],
  templateUrl: './tq-slider.component.html',
  styleUrl: './tq-slider.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => TqSliderComponent),
      multi: true,
    },
  ],
})
export class TqSliderComponent implements ControlValueAccessor {
  readonly min = input<number>(0);
  readonly max = input<number>(100);
  readonly step = input<number>(1);
  readonly label = input<string>('');

  @ViewChild('track') trackRef!: ElementRef<HTMLDivElement>;

  readonly value = signal<number>(0);
  readonly disabled = signal<boolean>(false);

  readonly fillPct = computed(() => {
    const range = this.max() - this.min();
    if (range === 0) return 0;
    return ((this.value() - this.min()) / range) * 100;
  });

  private onChange: (v: number) => void = () => {};
  private onTouched: () => void = () => {};
  private dragging = false;

  writeValue(v: number): void {
    this.value.set(v ?? this.min());
  }
  registerOnChange(fn: (v: number) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  setDisabledState(d: boolean): void {
    this.disabled.set(d);
  }

  onTrackClick(event: MouseEvent): void {
    if (this.disabled()) return;
    this.setFromEvent(event);
    this.onTouched();
  }

  onThumbMousedown(event: MouseEvent): void {
    if (this.disabled()) return;
    event.preventDefault();
    this.dragging = true;
  }

  @HostListener('window:mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    if (!this.dragging) return;
    this.setFromEvent(event);
  }

  @HostListener('window:mouseup')
  onMouseUp(): void {
    if (this.dragging) {
      this.dragging = false;
      this.onTouched();
    }
  }

  private setFromEvent(event: MouseEvent): void {
    const track = this.trackRef.nativeElement;
    const rect = track.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const raw = this.min() + pct * (this.max() - this.min());
    const stepped = Math.round(raw / this.step()) * this.step();
    const clamped = Math.max(this.min(), Math.min(this.max(), stepped));
    this.value.set(clamped);
    this.onChange(clamped);
  }
}
