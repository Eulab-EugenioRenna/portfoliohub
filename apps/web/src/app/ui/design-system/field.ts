import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'ph-field',
  templateUrl: './field.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PhField {
  readonly label = input.required<string>();
  readonly hint = input('');
  readonly error = input('');
}
