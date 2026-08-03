import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'ph-card',
  host: { class: 'block' },
  templateUrl: './card.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PhCard {}
