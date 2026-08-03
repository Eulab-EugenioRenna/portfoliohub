import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { LEGAL_DOCUMENTS, type LegalDocument, type LegalSection } from './legal-content';

interface RemotePolicy {
  kind: string;
  version?: string;
  effectiveAt?: string;
  content?: {
    title?: string;
    summary?: string;
    audience?: string;
    sections?: Array<{ id?: string; heading: string; body: string }>;
  };
  status?: string;
}

interface DisplayPolicy {
  kind: 'terms' | 'privacy';
  version: string;
  dateLabel: string;
  status: string;
  content: {
    title: string;
    summary: string;
    audience: string;
    sections: LegalSection[];
  };
}

@Component({
  selector: 'ph-public-policy',
  imports: [RouterLink],
  templateUrl: './public-policy.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicPolicyPage {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  protected readonly kind = signal<'terms' | 'privacy'>('terms');
  protected readonly policy = signal<DisplayPolicy | null>(null);
  protected readonly loading = signal(true);
  protected readonly sourceUnavailable = signal(false);
  protected readonly isDraft = computed(() => this.policy()?.status === 'draft-review');

  constructor() {
    this.route.paramMap.subscribe((params) => {
      const kind = params.get('kind') === 'privacy' ? 'privacy' : 'terms';
      this.kind.set(kind);
      void this.load(kind);
    });
  }

  protected documentLabel(): string {
    return this.kind() === 'terms' ? 'Termini' : 'Privacy';
  }

  private async load(kind: 'terms' | 'privacy'): Promise<void> {
    this.loading.set(true);
    this.sourceUnavailable.set(false);
    this.policy.set(null);
    try {
      const remote = await firstValueFrom(
        this.http.get<RemotePolicy>(`/api/v1/public/policies/${kind}`),
      );
      this.policy.set(this.fromRemote(remote, kind) ?? this.fromLocal(LEGAL_DOCUMENTS[kind]));
    } catch {
      this.sourceUnavailable.set(true);
      this.policy.set(this.fromLocal(LEGAL_DOCUMENTS[kind]));
    } finally {
      this.loading.set(false);
    }
  }

  private fromRemote(policy: RemotePolicy, kind: 'terms' | 'privacy'): DisplayPolicy | null {
    const content = policy.content;
    if (!content?.title || !content.sections?.length) return null;
    return {
      kind,
      version: policy.version ?? 'Versione corrente',
      dateLabel: policy.effectiveAt
        ? `Efficace dal ${this.formatDate(policy.effectiveAt)}`
        : 'Versione corrente',
      status: policy.status ?? 'effective',
      content: {
        title: content.title,
        summary: content.summary ?? '',
        audience: content.audience ?? '',
        sections: content.sections.map((section, index) => ({
          id: section.id ?? this.sectionId(section.heading, index),
          heading: section.heading,
          body: section.body,
        })),
      },
    };
  }

  private fromLocal(policy: LegalDocument): DisplayPolicy {
    return {
      kind: policy.kind,
      version: policy.version,
      dateLabel: `Aggiornata il ${this.formatDate(policy.updatedAt)}`,
      status: policy.status,
      content: policy.content,
    };
  }

  private sectionId(heading: string, index: number): string {
    return `${index + 1}-${heading}`
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('it')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private formatDate(value: string): string {
    return new Intl.DateTimeFormat('it-IT', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(value));
  }
}
