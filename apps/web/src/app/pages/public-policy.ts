import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';

interface Policy {
  kind: string;
  version?: string;
  effectiveAt?: string;
  content?: { title?: string; sections?: Array<{ heading: string; body: string }> };
  status?: string;
}
@Component({
  selector: 'ph-public-policy',
  templateUrl: './public-policy.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicPolicyPage {
  private readonly http = inject(HttpClient);
  protected readonly kind = inject(ActivatedRoute).snapshot.paramMap.get('kind') ?? 'terms';
  protected readonly policy = signal<Policy | null>(null);
  constructor() {
    void this.load();
  }
  private async load(): Promise<void> {
    this.policy.set(
      await firstValueFrom(this.http.get<Policy>(`/api/v1/public/policies/${this.kind}`)),
    );
  }
}
