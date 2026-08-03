import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { IsNull } from 'typeorm';
import { FileNodeEntity } from '../files/entities/file-node.entity';
import { FileVersionEntity } from '../files/entities/file-version.entity';
import { WorkspaceEntity } from '../workspaces/entities/workspace.entity';
import { WorkspacesService } from '../workspaces/workspaces.service';
import type { UpdatePortfolioDto } from './dto/portfolio.dto';
import { type PortfolioDocument, PortfolioSiteEntity } from './entities/portfolio-site.entity';

const RESERVED = new Set([
  'www',
  'app',
  'api',
  'admin',
  'delivery',
  'status',
  'support',
  'help',
  'mail',
  'cdn',
]);

@Injectable()
export class PortfolioService {
  constructor(
    @InjectRepository(PortfolioSiteEntity) private readonly sites: Repository<PortfolioSiteEntity>,
    private readonly workspaces: WorkspacesService,
  ) {}

  async getDraft(workspaceId: string, userId: string): Promise<PortfolioSiteEntity> {
    await this.workspaces.assertRole(workspaceId, userId, ['owner', 'admin', 'editor']);
    return (await this.sites.findOneBy({ workspaceId })) ?? this.createDefault(workspaceId);
  }

  async update(
    workspaceId: string,
    userId: string,
    dto: UpdatePortfolioDto,
  ): Promise<PortfolioSiteEntity> {
    await this.workspaces.assertRole(workspaceId, userId, ['owner', 'admin', 'editor']);
    if (RESERVED.has(dto.slug)) throw new ConflictException('Slug riservato');
    const other = await this.sites.findOneBy({ slug: dto.slug });
    if (other && other.workspaceId !== workspaceId)
      throw new ConflictException('Slug già utilizzato');
    const current =
      (await this.sites.findOneBy({ workspaceId })) ?? (await this.createDefault(workspaceId));
    current.slug = dto.slug;
    current.draft = this.normalize(dto.document);
    current.draftRevision += 1;
    current.updatedAt = new Date();
    return this.sites.save(current);
  }

  async publish(workspaceId: string, userId: string): Promise<PortfolioSiteEntity> {
    await this.workspaces.assertRole(workspaceId, userId, ['owner', 'admin', 'editor']);
    const site = await this.sites.findOneBy({ workspaceId });
    if (!site) throw new NotFoundException('Portfolio non configurato');
    site.publishedSnapshot = structuredClone(site.draft);
    site.publishedRevision = site.draftRevision;
    site.publishedAt = new Date();
    site.updatedAt = new Date();
    return this.sites.save(site);
  }

  async publicSite(slug: string): Promise<{ document: PortfolioDocument; publishedAt: Date }> {
    const site = await this.sites.findOneBy({ slug });
    if (!site?.publishedSnapshot || !site.publishedAt)
      throw new NotFoundException('Portfolio non pubblicato');
    const workspace = await this.sites.manager
      .getRepository(WorkspaceEntity)
      .findOneBy({ id: site.workspaceId, status: 'active' });
    if (!workspace) throw new NotFoundException('Portfolio non disponibile');
    return {
      document: this.normalize(site.publishedSnapshot as unknown as Record<string, unknown>),
      publishedAt: site.publishedAt,
    };
  }

  async privateMedia(
    workspaceId: string,
    userId: string,
    nodeId: string,
  ): Promise<FileVersionEntity> {
    await this.workspaces.assertRole(workspaceId, userId, ['owner', 'admin', 'editor']);
    return this.mediaVersion(workspaceId, nodeId);
  }

  async publicMedia(slug: string, nodeId: string): Promise<FileVersionEntity> {
    const site = await this.sites.findOneBy({ slug });
    if (!site?.publishedSnapshot) throw new NotFoundException('Portfolio non pubblicato');
    const workspace = await this.sites.manager
      .getRepository(WorkspaceEntity)
      .findOneBy({ id: site.workspaceId, status: 'active' });
    if (!workspace) throw new NotFoundException('Portfolio non disponibile');
    const document = this.normalize(site.publishedSnapshot as unknown as Record<string, unknown>);
    const allowed = new Set([
      document.identity.logoNodeId,
      ...document.media.map((asset) => asset.nodeId),
    ]);
    if (!allowed.has(nodeId)) throw new NotFoundException('Media non disponibile');
    return this.mediaVersion(site.workspaceId, nodeId);
  }

  private async mediaVersion(workspaceId: string, nodeId: string): Promise<FileVersionEntity> {
    const node = await this.sites.manager.getRepository(FileNodeEntity).findOneBy({
      id: nodeId,
      workspaceId,
      kind: 'file',
      trashedAt: IsNull(),
    });
    if (!node?.currentVersionId) throw new NotFoundException('Media non disponibile');
    return this.sites.manager
      .getRepository(FileVersionEntity)
      .findOneByOrFail({ id: node.currentVersionId });
  }

  private async createDefault(workspaceId: string): Promise<PortfolioSiteEntity> {
    const workspace = await this.sites.manager
      .getRepository(WorkspaceEntity)
      .findOneByOrFail({ id: workspaceId });
    const now = new Date();
    return this.sites.save(
      this.sites.create({
        id: randomUUID(),
        workspaceId,
        slug: workspace.slug,
        draft: {
          identity: { title: workspace.name, tagline: 'Immagini precise. Consegne senza rumore.' },
          cta: { label: 'Parliamo del tuo progetto', url: 'mailto:info@example.com' },
          contact: {},
          socials: [],
          media: [],
          theme: { mode: 'light', accent: '#1e5cdb', font: 'editorial' },
          sections: [
            { id: randomUUID(), type: 'hero', enabled: true, data: {} },
            { id: randomUUID(), type: 'projects', enabled: true, data: { selectedVersionIds: [] } },
            { id: randomUUID(), type: 'contact', enabled: true, data: {} },
          ],
          seo: { title: workspace.name, description: `Portfolio di ${workspace.name}` },
        },
        draftRevision: 1,
        publishedSnapshot: null,
        publishedRevision: null,
        publishedAt: null,
        createdAt: now,
        updatedAt: now,
      }),
    );
  }

  private normalize(raw: Record<string, unknown>): PortfolioDocument {
    const identity = raw['identity'] as Record<string, unknown> | undefined;
    const theme = raw['theme'] as Record<string, unknown> | undefined;
    const seo = raw['seo'] as Record<string, unknown> | undefined;
    const sections = Array.isArray(raw['sections']) ? raw['sections'] : [];
    const title = String(identity?.['title'] ?? '')
      .trim()
      .slice(0, 120);
    if (!title) throw new BadRequestException('Titolo portfolio richiesto');
    const safeUrl = (value: unknown, allowMail = false): string => {
      const candidate = String(value ?? '').trim();
      if (!candidate) return '';
      try {
        const url = new URL(candidate);
        if (
          url.protocol === 'https:' ||
          url.protocol === 'http:' ||
          (allowMail && url.protocol === 'mailto:')
        )
          return url.toString();
      } catch {}
      return '';
    };
    const cta = raw['cta'] as Record<string, unknown> | undefined;
    const contact = raw['contact'] as Record<string, unknown> | undefined;
    const socials = Array.isArray(raw['socials']) ? raw['socials'] : [];
    const media = Array.isArray(raw['media']) ? raw['media'] : [];
    return {
      identity: {
        title,
        tagline: String(identity?.['tagline'] ?? '')
          .trim()
          .slice(0, 240),
        about:
          String(identity?.['about'] ?? '')
            .trim()
            .slice(0, 5000) || undefined,
        logoUrl: safeUrl(identity?.['logoUrl']) || undefined,
        logoNodeId: String(identity?.['logoNodeId'] ?? '') || undefined,
      },
      cta:
        String(cta?.['label'] ?? '').trim() && safeUrl(cta?.['url'], true)
          ? {
              label: String(cta?.['label']).trim().slice(0, 80),
              url: safeUrl(cta?.['url'], true),
            }
          : undefined,
      contact: {
        email:
          String(contact?.['email'] ?? '')
            .trim()
            .slice(0, 254) || undefined,
        phone:
          String(contact?.['phone'] ?? '')
            .trim()
            .slice(0, 40) || undefined,
        location:
          String(contact?.['location'] ?? '')
            .trim()
            .slice(0, 160) || undefined,
      },
      socials: socials.flatMap((value) => {
        const social = value as Record<string, unknown>;
        const label = String(social['label'] ?? '')
          .trim()
          .slice(0, 40);
        const url = safeUrl(social['url']);
        return label && url ? [{ label, url }] : [];
      }),
      media: media.flatMap((value) => {
        const asset = value as Record<string, unknown>;
        const url = safeUrl(asset['url']);
        const nodeId = String(asset['nodeId'] ?? '');
        if (!url && !nodeId) return [];
        return [
          {
            id: String(asset['id'] ?? randomUUID()),
            type: asset['type'] === 'video' ? ('video' as const) : ('image' as const),
            url,
            nodeId: nodeId || undefined,
            alt: String(asset['alt'] ?? '')
              .trim()
              .slice(0, 180),
            caption:
              String(asset['caption'] ?? '')
                .trim()
                .slice(0, 240) || undefined,
          },
        ];
      }),
      theme: {
        mode: theme?.['mode'] === 'dark' ? 'dark' : 'light',
        accent: /^#[0-9a-f]{6}$/i.test(String(theme?.['accent']))
          ? String(theme?.['accent'])
          : '#1e5cdb',
        font: (['editorial', 'modern', 'classic'].includes(String(theme?.['font']))
          ? String(theme?.['font'])
          : 'editorial') as 'editorial' | 'modern' | 'classic',
      },
      sections: sections.slice(0, 20).flatMap((value) => {
        const section = value as Record<string, unknown>;
        const type = String(section['type']);
        if (!['hero', 'projects', 'about', 'contact'].includes(type)) return [];
        return [
          {
            id: String(section['id'] ?? randomUUID()),
            type: type as 'hero' | 'projects' | 'about' | 'contact',
            enabled: section['enabled'] !== false,
            data:
              typeof section['data'] === 'object' && section['data']
                ? (section['data'] as Record<string, unknown>)
                : {},
          },
        ];
      }),
      seo: {
        title: String(seo?.['title'] ?? title).slice(0, 70),
        description: String(seo?.['description'] ?? '').slice(0, 170),
      },
    };
  }
}
