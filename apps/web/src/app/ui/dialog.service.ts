import { Injectable, signal } from '@angular/core';

export interface DialogRequest {
  kind: 'alert' | 'confirm' | 'prompt';
  title: string;
  message: string;
  value: string;
  confirmLabel: string;
  cancelLabel: string;
  inputLabel: string;
  inputType: 'text' | 'email' | 'password' | 'url' | 'tel';
  placeholder: string;
}

@Injectable({ providedIn: 'root' })
export class DialogService {
  readonly active = signal<DialogRequest | null>(null);
  private settle?: (value: boolean | string | null) => void;

  alert(message: string, title = 'Informazione'): Promise<void> {
    return this.open({
      kind: 'alert',
      title,
      message,
      value: '',
      confirmLabel: 'Ok',
      cancelLabel: '',
      inputLabel: '',
      inputType: 'text',
      placeholder: '',
    }).then(() => undefined);
  }

  confirm(
    message: string,
    options: { title?: string; confirmLabel?: string; cancelLabel?: string } = {},
  ): Promise<boolean> {
    return this.open({
      kind: 'confirm',
      title: options.title ?? 'Conferma operazione',
      message,
      value: '',
      confirmLabel: options.confirmLabel ?? 'Conferma',
      cancelLabel: options.cancelLabel ?? 'Annulla',
      inputLabel: '',
      inputType: 'text',
      placeholder: '',
    }).then((value) => value === true);
  }

  prompt(
    message: string,
    options: {
      title?: string;
      value?: string;
      confirmLabel?: string;
      cancelLabel?: string;
      inputLabel?: string;
      inputType?: DialogRequest['inputType'];
      placeholder?: string;
    } = {},
  ): Promise<string | null> {
    return this.open({
      kind: 'prompt',
      title: options.title ?? 'Inserisci i dati',
      message,
      value: options.value ?? '',
      confirmLabel: options.confirmLabel ?? 'Continua',
      cancelLabel: options.cancelLabel ?? 'Annulla',
      inputLabel: options.inputLabel ?? 'Valore',
      inputType: options.inputType ?? 'text',
      placeholder: options.placeholder ?? 'Inserisci un valore',
    }).then((value) => (typeof value === 'string' ? value : null));
  }

  resolve(value: boolean | string | null): void {
    const settle = this.settle;
    this.settle = undefined;
    this.active.set(null);
    settle?.(value);
  }

  private open(request: DialogRequest): Promise<boolean | string | null> {
    if (this.settle) this.resolve(null);
    this.active.set(request);
    return new Promise((resolve) => {
      this.settle = resolve;
    });
  }
}
