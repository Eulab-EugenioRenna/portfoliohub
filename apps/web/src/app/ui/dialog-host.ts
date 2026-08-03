import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AppendToBody } from './append-to-body';
import { DialogService } from './dialog.service';

@Component({
  selector: 'ph-dialog-host',
  imports: [FormsModule, AppendToBody],
  templateUrl: './dialog-host.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DialogHost {
  protected readonly dialogs = inject(DialogService);
  protected value = '';

  constructor() {
    effect(() => {
      this.value = this.dialogs.active()?.value ?? '';
    });
  }

  protected submit(event: Event): void {
    event.preventDefault();
    const request = this.dialogs.active();
    if (!request) return;
    this.dialogs.resolve(request.kind === 'prompt' ? this.value : true);
  }

  protected cancel(): void {
    const request = this.dialogs.active();
    this.dialogs.resolve(request?.kind === 'confirm' ? false : null);
  }
}
