import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  forwardRef,
  HostListener,
  inject,
  input,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { AppendToBody } from './append-to-body';

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
}

@Component({
  selector: 'ph-select',
  imports: [AppendToBody],
  templateUrl: './custom-select.html',
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => CustomSelect), multi: true },
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomSelect implements ControlValueAccessor {
  private readonly element = inject(ElementRef<HTMLElement>);
  readonly options = input<SelectOption[]>([]);
  readonly ariaLabel = input('Seleziona');
  readonly placeholder = input('Seleziona');
  readonly filterable = input(false);
  readonly open = signal(false);
  readonly query = signal('');
  readonly value = signal('');
  readonly disabled = signal(false);
  readonly filteredOptions = computed(() => {
    const query = this.query().trim().toLocaleLowerCase('it');
    if (!query) return this.options();
    return this.options().filter(
      (option) =>
        option.label.toLocaleLowerCase('it').includes(query) ||
        option.description?.toLocaleLowerCase('it').includes(query),
    );
  });
  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  selectedLabel(): string {
    return (
      this.options().find((option) => option.value === this.value())?.label ?? this.placeholder()
    );
  }

  toggle(): void {
    this.open.update((value) => !value);
    if (!this.open()) this.query.set('');
  }

  choose(value: string): void {
    this.value.set(value);
    this.open.set(false);
    this.query.set('');
    this.onChange(value);
    this.onTouched();
  }

  writeValue(value: string | null): void {
    this.value.set(value ?? '');
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.disabled.set(disabled);
  }

  @HostListener('document:click', ['$event'])
  closeOutside(event: Event): void {
    const target = event.target as Node;
    if (
      !this.element.nativeElement.contains(target) &&
      !(target instanceof Element && target.closest('[data-body-overlay][role="listbox"]'))
    ) {
      this.open.set(false);
      this.query.set('');
    }
  }
}
