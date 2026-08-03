import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

export type NoticeTone = 'info' | 'success' | 'warning' | 'danger';

@Component({
  selector: 'ph-notice-banner',
  templateUrl: './notice-banner.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PhNoticeBanner {
  readonly tone = input<NoticeTone>('info');
  readonly title = input.required<string>();
  readonly message = input.required<string>();
  readonly actionLabel = input('');
  readonly dismissible = input(true);
  readonly action = output<void>();
  readonly closed = output<void>();

  protected toneClasses(): string {
    return {
      info: 'border-brand/30 bg-brand/12 text-brand',
      success: 'border-positive/30 bg-positive/12 text-positive',
      warning: 'border-caution/30 bg-caution/12 text-caution',
      danger: 'border-negative/30 bg-negative/12 text-negative',
    }[this.tone()];
  }
}
