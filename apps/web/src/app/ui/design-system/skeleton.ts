import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'ph-skeleton',
  templateUrl: './skeleton.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PhSkeleton {
  readonly variant = input<'line' | 'card' | 'avatar' | 'table'>('line');
  readonly rows = input(3);
}
