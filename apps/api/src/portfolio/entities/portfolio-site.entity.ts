import { Column, Entity, PrimaryColumn } from 'typeorm';

export interface PortfolioDocument {
  identity: {
    title: string;
    tagline: string;
    about?: string;
    logoUrl?: string;
    logoNodeId?: string;
  };
  cta?: { label: string; url: string };
  contact?: { email?: string; phone?: string; location?: string };
  socials: Array<{ label: string; url: string }>;
  media: Array<{
    id: string;
    type: 'image' | 'video';
    url: string;
    nodeId?: string;
    alt: string;
    caption?: string;
  }>;
  theme: { mode: 'light' | 'dark'; accent: string; font: string };
  sections: Array<{
    id: string;
    type: 'hero' | 'projects' | 'about' | 'contact';
    enabled: boolean;
    data: Record<string, unknown>;
  }>;
  seo: { title: string; description: string };
}

@Entity({ name: 'portfolio_sites' })
export class PortfolioSiteEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column('uuid', { name: 'workspace_id', unique: true }) workspaceId!: string;
  @Column({ length: 80, unique: true }) slug!: string;
  @Column({ type: 'jsonb' }) draft!: PortfolioDocument;
  @Column({ name: 'draft_revision', type: 'integer' }) draftRevision!: number;
  @Column({ name: 'published_snapshot', type: 'jsonb', nullable: true })
  publishedSnapshot!: PortfolioDocument | null;
  @Column({ name: 'published_revision', type: 'integer', nullable: true }) publishedRevision!:
    | number
    | null;
  @Column({ name: 'published_at', type: 'timestamptz', nullable: true }) publishedAt!: Date | null;
  @Column({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
  @Column({ name: 'updated_at', type: 'timestamptz' }) updatedAt!: Date;
}
