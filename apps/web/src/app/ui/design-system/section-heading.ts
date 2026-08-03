import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'ph-section-heading',
  templateUrl: './section-heading.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PhSectionHeading {
  readonly eyebrow = input('');
  readonly title = input.required<string>();
  readonly description = input('');
}
