import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'ph-badge',
  templateUrl: './badge.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PhBadge {}
