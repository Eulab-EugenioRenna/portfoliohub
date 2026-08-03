import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type ButtonTone = 'solid' | 'outline' | 'ghost' | 'danger';

const BUTTON_TONES: Record<ButtonTone, string> = {
  solid:
    'border-transparent bg-gradient-to-br from-brand-deep to-brand text-white shadow-[0_10px_28px_rgba(30,92,219,.24)] hover:-translate-y-0.5 hover:brightness-110',
  outline:
    'border-stroke bg-panel-raised text-ink hover:-translate-y-0.5 hover:border-brand/40 hover:bg-panel-strong',
  ghost: 'border-transparent bg-transparent text-ink-muted hover:bg-panel-raised hover:text-ink',
  danger:
    'border-negative/35 bg-negative/10 text-negative hover:-translate-y-0.5 hover:bg-negative/15',
};

@Component({
  selector: 'ph-button',
  templateUrl: './button.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PhButton {
  readonly tone = input<ButtonTone>('solid');
  readonly type = input<'button' | 'submit'>('button');
  readonly disabled = input(false);
  readonly loading = input(false);
  readonly fullWidth = input(false);

  protected classes(): string {
    return `${this.fullWidth() ? 'flex w-full' : 'inline-flex'} min-h-11 items-center justify-center gap-2 rounded-ui border px-4 text-[0.8125rem] font-bold transition duration-150 focus-visible:outline-3 focus-visible:outline-brand/35 disabled:pointer-events-none disabled:opacity-45 ${BUTTON_TONES[this.tone()]}`;
  }
}
