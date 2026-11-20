import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthStore } from '../core/auth.store';

/**
 * Stato temporaneo mostrato quando `/auth/me` non risponde a freddo: la sessione
 * non è stata dichiarata scaduta, quindi non si manda l'utente al login.
 */
@Component({
  selector: 'ph-service-unavailable',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="grid min-h-dvh place-items-center bg-canvas p-5">
      <section
        class="w-full max-w-[480px] rounded-shell border border-stroke bg-panel p-8 shadow-float"
        role="status"
      >
        <span class="text-xs font-black tracking-[0.16em] text-brand uppercase"
          >Servizio non raggiungibile</span
        >
        <h1 class="mt-3 text-3xl font-extrabold tracking-[-0.04em]">Riprova tra un momento.</h1>
        <p class="mt-3 text-sm leading-7 text-ink-muted">
          Non riusciamo a contattare il server per verificare la tua sessione. Non sei stato
          disconnesso: se la sessione è valida, appena il servizio torna raggiungibile verrai
          riconosciuto.
        </p>
        @if (stillUnavailable()) {
          <p class="mt-3 text-sm font-bold text-ink" data-still-unavailable>
            Il servizio non risponde ancora. Riprova fra qualche secondo.
          </p>
        }
        <button
          class="mt-7 flex min-h-12 w-full items-center justify-center rounded-ui bg-brand px-4 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-60"
          type="button"
          data-retry
          [disabled]="retrying()"
          (click)="retry()"
        >
          {{ retrying() ? 'Verifico…' : 'Riprova' }}
        </button>
      </section>
    </main>
  `,
})
export class ServiceUnavailablePage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthStore);
  protected readonly retrying = signal(false);
  protected readonly stillUnavailable = signal(false);

  protected async retry(): Promise<void> {
    this.retrying.set(true);
    this.stillUnavailable.set(false);
    try {
      const check = await this.auth.checkSession();
      if (check === 'unavailable') {
        this.stillUnavailable.set(true);
        return;
      }
      const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/panoramica';
      if (check === 'authenticated') {
        await this.router.navigateByUrl(returnUrl);
      } else {
        await this.router.navigate(['/accedi'], { queryParams: { returnUrl } });
      }
    } finally {
      this.retrying.set(false);
    }
  }
}
