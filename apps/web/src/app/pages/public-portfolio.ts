import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';

interface PortfolioDocument {
  identity: {
    title: string;
    tagline: string;
    about?: string;
    logoUrl?: string;
    logoNodeId?: string;
  };
  cta?: { label: string; url: string };
  contact?: { email?: string; phone?: string; location?: string };
  socials?: Array<{ label: string; url: string }>;
  media?: Array<{
    id: string;
    type: 'image' | 'video';
    url: string;
    nodeId?: string;
    alt: string;
    caption?: string;
  }>;
  theme: { mode: 'light' | 'dark'; accent: string; font: string };
  sections: Array<{ id: string; type: string; enabled: boolean; data: Record<string, unknown> }>;
  seo: { title: string; description: string };
}
@Component({
  selector: 'ph-public-portfolio',
  templateUrl: './public-portfolio.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicPortfolioPage {
  private readonly http = inject(HttpClient);
  private readonly slug = inject(ActivatedRoute).snapshot.paramMap.get('slug') ?? '';
  protected readonly document = signal<PortfolioDocument | null>(null);
  protected readonly error = signal('');
  constructor() {
    void this.load();
  }

  protected logoUrl(site: PortfolioDocument): string {
    return site.identity.logoNodeId
      ? this.driveMediaUrl(site.identity.logoNodeId)
      : (site.identity.logoUrl ?? '');
  }

  protected mediaUrl(asset: { url: string; nodeId?: string }): string {
    return asset.nodeId ? this.driveMediaUrl(asset.nodeId) : asset.url;
  }

  private driveMediaUrl(nodeId: string): string {
    return `/api/v1/public/portfolio/${this.slug}/media/${nodeId}`;
  }

  private async load(): Promise<void> {
    try {
      const result = await firstValueFrom(
        this.http.get<{ document: PortfolioDocument }>(`/api/v1/public/portfolio/${this.slug}`),
      );
      this.document.set(result.document);
      document.title = `${result.document.seo.title} · PortfolioHub`;
    } catch {
      this.error.set('Portfolio non disponibile.');
    }
  }
}
