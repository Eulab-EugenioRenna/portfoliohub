import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

export type StatusStateKind = 'loading' | 'empty' | 'error' | 'blocked';

@Component({
  selector: 'ph-status-state',
  templateUrl: './status-state.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusState {
  readonly kind = input.required<StatusStateKind>();
  readonly title = input.required<string>();
  readonly description = input.required<string>();
  readonly actionLabel = input<string>();
  readonly action = output<void>();
}
