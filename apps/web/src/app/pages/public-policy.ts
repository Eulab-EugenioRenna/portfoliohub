import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

interface Policy {
  kind: string;
  version?: string;
  effectiveAt?: string;
  content?: { title?: string; sections?: Array<{ heading: string; body: string }> };
  status?: string;
}

const POLICY_PLANS: Record<string, { title: string; summary: string; sections: string[] }> = {
  terms: {
    title: 'Termini e condizioni',
    summary:
      'Condizioni d’uso, prova Pro, abbonamenti, rinnovi, cancellazione e uso corretto della piattaforma.',
    sections: [
      'Account, workspace e responsabilità degli utenti',
      'Prova Pro di 30 giorni e passaggio al piano Free',
      'Piani, rinnovi, cancellazione e rimborsi',
      'Contenuti, consegne e acceptable use',
      'Sospensione, ricorso e chiusura del servizio',
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    summary: 'Informativa per utenti, clienti, visitatori e contatti dei portfolio pubblicati.',
    sections: [
      'Titolare, contatti privacy e ruoli del trattamento',
      'Dati trattati, finalità e basi giuridiche',
      'Fornitori, subprocessori e trasferimenti',
      'Conservazione, sicurezza e cancellazione',
      'Diritti, richieste privacy e tempi di risposta',
    ],
  },
};
@Component({
  selector: 'ph-public-policy',
  imports: [RouterLink],
  templateUrl: './public-policy.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicPolicyPage {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  protected readonly kind = signal('terms');
  protected readonly policy = signal<Policy | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly plan = signal(POLICY_PLANS['terms']);
  constructor() {
    this.route.paramMap.subscribe((params) => {
      const kind = params.get('kind') ?? 'terms';
      this.kind.set(kind);
      this.plan.set(POLICY_PLANS[kind] ?? POLICY_PLANS['terms']);
      void this.load(kind);
    });
  }
  private async load(kind: string): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    this.policy.set(null);
    try {
      this.policy.set(
        await firstValueFrom(this.http.get<Policy>(`/api/v1/public/policies/${kind}`)),
      );
    } catch {
      this.error.set('Il documento non è disponibile in questo momento.');
    } finally {
      this.loading.set(false);
    }
  }
}
