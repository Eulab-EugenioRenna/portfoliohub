import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  type OnDestroy,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { BILLING_PORTAL_URL } from '../core/billing-portal';
import { UiStore } from '../core/ui-store';
import { WorkspaceStore } from '../core/workspace.store';
import { AppendToBody } from '../ui/append-to-body';
import { CustomSelect, type SelectOption } from '../ui/custom-select';
import { DialogService } from '../ui/dialog.service';
import { ShareDialog, type ShareTarget } from '../ui/share-dialog';

type Section = 'projects' | 'clients' | 'deliveries' | 'portfolio' | 'team' | 'settings';
interface Project {
  id: string;
  name: string;
  clientId: string | null;
  status: string;
  updatedAt: string;
}
interface Client {
  id: string;
  name: string;
  email: string | null;
}
interface Delivery {
  id: string;
  title: string;
  status: string;
  expiresAt: string | null;
  completedDownloads: number;
  oneShot: boolean;
  url: string | null;
  projectName: string;
  clientName: string | null;
  itemCount: number;
  commentCount: number;
  approvalCount: number;
  lastActivityAt: string;
}
interface DeliveryActivity {
  comments: Array<{ id: string; authorName: string; body: string; createdAt: string }>;
  approvals: Array<{
    id: string;
    authorName: string;
    decision: 'approved' | 'changes_requested';
    note: string | null;
    createdAt: string;
  }>;
}
interface Invite {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  projectId: string | null;
  nodeId: string | null;
  scopeKind: 'file' | 'folder' | null;
  scopeName: string | null;
}
interface Portfolio {
  slug: string;
  draft: {
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
    theme: { accent: string; mode: string; font: string };
    sections: unknown[];
    seo: { title: string; description: string };
  };
  publishedAt: string | null;
}
interface Billing {
  plan: 'free' | 'pro' | 'unlimited';
  workspaceStatus: string;
  usage: { storageBytes: string; trafficBytes: string };
  commercialUsage: { storageGb: number; trafficGb: number };
  subscription: {
    status: string;
    billingInterval: 'monthly' | 'annual' | null;
    currentPeriodEnd: string | null;
  } | null;
}
interface BillingPlan {
  id: 'free' | 'pro' | 'unlimited';
  monthly: number;
  annual: number;
  storageGb: number | null;
  trafficGb: number | null;
  projects: number | null;
  members: number | null;
  maxFileGb: number;
  workspaces: number | null;
  fairUse?: boolean;
}
interface BillingCatalog {
  provider: 'local' | 'stripe';
  publishableKey: string;
  annualDiscountPercent: number;
  plans: BillingPlan[];
}
interface EmbeddedCheckout {
  mount(selector: string): void;
  destroy(): void;
}
interface StripeClient {
  initEmbeddedCheckout(options: {
    fetchClientSecret: () => Promise<string>;
    onComplete: () => void;
  }): Promise<EmbeddedCheckout>;
}
declare global {
  interface Window {
    Stripe?: (publishableKey: string) => StripeClient;
  }
}
interface CollectionDetail {
  kind: 'client' | 'delivery' | 'invite';
  title: string;
  subtitle: string;
  fields: Array<{ label: string; value: string; tone?: 'negative' | 'positive' }>;
  client?: Client;
  delivery?: Delivery;
}

const COPY = {
  projects: [
    'Produzione',
    'Progetti',
    'File, versioni e persone riuniti attorno al lavoro.',
    'Nuovo progetto',
  ],
  clients: [
    'Relazioni',
    'Clienti',
    'Ogni cliente vede soltanto ciò che gli è stato consegnato.',
    'Nuovo cliente',
  ],
  deliveries: [
    'Attività condivisa',
    'Consegne',
    'Link attivi, commenti e decisioni ricevute da clienti e collaboratori.',
    'Apri i progetti',
  ],
  portfolio: [
    'Pubblicazione',
    'Portfolio',
    'Una selezione pubblica essenziale, aggiornata senza duplicare file.',
    'Pubblica',
  ],
  team: ['Workspace', 'Team', 'Inviti autenticati, ruoli e ambiti espliciti.', 'Invita membro'],
  settings: ['Controllo', 'Impostazioni', 'Piano, quote, sicurezza e lifecycle.', 'Gestisci piano'],
} satisfies Record<Section, [string, string, string, string]>;

@Component({
  selector: 'ph-collection-page',
  imports: [FormsModule, RouterLink, DatePipe, AppendToBody, CustomSelect, ShareDialog],
  templateUrl: './collection-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CollectionPage implements OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly http = inject(HttpClient);
  private readonly dialogs = inject(DialogService);
  protected readonly ui = inject(UiStore);
  protected readonly workspaces = inject(WorkspaceStore);
  private readonly routeData = toSignal(this.route.data, {
    initialValue: this.route.snapshot.data,
  });
  protected readonly section = computed(() => this.routeData()['section'] as Section);
  protected readonly copy = computed(() => COPY[this.section()]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly projects = signal<Project[]>([]);
  protected readonly clients = signal<Client[]>([]);
  protected readonly deliveries = signal<Delivery[]>([]);
  protected readonly invites = signal<Invite[]>([]);
  protected readonly portfolio = signal<Portfolio | null>(null);
  protected readonly billing = signal<Billing | null>(null);
  protected readonly billingCatalog = signal<BillingCatalog | null>(null);
  protected readonly billingAnnual = signal(false);
  protected readonly checkoutOpen = signal(false);
  protected readonly checkoutLoading = signal(false);
  protected readonly checkoutPlan = signal<'pro' | 'unlimited' | null>(null);
  protected readonly selectedDetail = signal<CollectionDetail | null>(null);
  protected readonly deliveryActivity = signal<DeliveryActivity | null>(null);
  protected readonly shareTarget = signal<ShareTarget | null>(null);
  protected readonly projectEditor = signal<Project | 'new' | null>(null);
  protected readonly projectName = signal('');
  protected readonly projectClientId = signal('');
  protected readonly projectSaving = signal(false);
  protected readonly deletingId = signal<string | null>(null);
  protected readonly clientOptions = computed<SelectOption[]>(() => [
    { value: '', label: 'Nessun cliente', description: 'Il progetto resta indipendente' },
    ...this.clients().map((client) => ({
      value: client.id,
      label: client.name,
      description: client.email ?? 'Email non configurata',
    })),
  ]);
  protected portfolioName = '';
  protected portfolioTagline = '';
  protected portfolioAbout = '';
  protected portfolioLogoUrl = '';
  protected portfolioLogoNodeId = '';
  protected portfolioCtaLabel = '';
  protected portfolioCtaKind: 'link' | 'whatsapp' | 'email' = 'link';
  protected portfolioCtaTarget = '';
  protected readonly portfolioUploading = signal(false);
  protected readonly portfolioUploadProgress = signal(0);
  protected portfolioEmail = '';
  protected portfolioPhone = '';
  protected portfolioLocation = '';
  protected portfolioSocials: Array<{ label: string; url: string }> = [];
  protected portfolioMedia: Array<{
    id: string;
    type: 'image' | 'video';
    url: string;
    nodeId?: string;
    alt: string;
    caption?: string;
  }> = [];
  private embeddedCheckout: EmbeddedCheckout | null = null;
  private stripeLoader: Promise<StripeClient> | null = null;

  constructor() {
    effect(() => {
      const workspaceId = this.workspaces.current()?.workspace.id;
      const section = this.section();
      if (workspaceId) void this.load(workspaceId, section);
    });
  }

  ngOnDestroy(): void {
    this.destroyEmbeddedCheckout();
  }

  protected async act(): Promise<void> {
    const workspaceId = this.workspaces.current()?.workspace.id;
    if (!workspaceId) return;
    try {
      if (this.section() === 'projects') {
        this.openProjectEditor();
        return;
      }
      if (this.section() === 'clients') {
        const name = await this.dialogs.prompt('Nome cliente', {
          title: 'Nuovo cliente',
          inputLabel: 'Nome cliente',
          inputType: 'text',
          placeholder: 'Mario Rossi o Azienda S.r.l.',
        });
        const email = name
          ? await this.dialogs.prompt('Email cliente (facoltativa)', {
              title: 'Nuovo cliente',
              inputLabel: 'Email cliente',
              inputType: 'email',
              placeholder: 'cliente@esempio.it',
            })
          : null;
        if (name?.trim())
          await firstValueFrom(
            this.http.post(`/api/v1/workspaces/${workspaceId}/clients`, {
              name,
              email: email || undefined,
            }),
          );
      }
      if (this.section() === 'team') {
        const email = await this.dialogs.prompt('Email collaboratore', {
          title: 'Invita collaboratore',
          confirmLabel: 'Invita',
          inputLabel: 'Email collaboratore',
          inputType: 'email',
          placeholder: 'collaboratore@studio.it',
        });
        if (email)
          await firstValueFrom(
            this.http.post(`/api/v1/workspaces/${workspaceId}/collaboration-invites`, {
              email,
              role: 'editor',
            }),
          );
      }
      if (this.section() === 'portfolio') await this.savePortfolio(workspaceId, true);
      if (this.section() === 'settings') {
        document.querySelector('#pricing-plans')?.scrollIntoView({ behavior: 'smooth' });
        return;
      }
      await this.load(workspaceId, this.section());
    } catch (error) {
      this.error.set(this.message(error));
    }
  }

  protected openProjectEditor(project?: Project): void {
    this.projectName.set(project?.name ?? '');
    this.projectClientId.set(project?.clientId ?? '');
    this.projectEditor.set(project ?? 'new');
  }

  protected async saveProject(): Promise<void> {
    const workspaceId = this.workspaces.current()?.workspace.id;
    const editor = this.projectEditor();
    if (!workspaceId || !editor || this.projectName().trim().length < 2) return;
    this.projectSaving.set(true);
    try {
      const body = { name: this.projectName().trim(), clientId: this.projectClientId() || null };
      if (editor === 'new') {
        await firstValueFrom(
          this.http.post(`/api/v1/workspaces/${workspaceId}/projects`, {
            ...body,
            clientId: body.clientId || undefined,
          }),
        );
      } else {
        await firstValueFrom(
          this.http.patch(`/api/v1/workspaces/${workspaceId}/projects/${editor.id}`, body),
        );
      }
      this.projectEditor.set(null);
      await this.load(workspaceId, 'projects');
      this.ui.notify(editor === 'new' ? 'Progetto creato' : 'Progetto aggiornato');
    } catch (error) {
      this.error.set(this.message(error));
    } finally {
      this.projectSaving.set(false);
    }
  }

  protected async deleteProject(project: Project): Promise<void> {
    const workspaceId = this.workspaces.current()?.workspace.id;
    if (!workspaceId || this.deletingId()) return;
    const confirmed = await this.dialogs.confirm(
      `Eliminare il progetto “${project.name}” e tutti i link collegati? I file non saranno più accessibili e verranno cancellati definitivamente dopo 30 giorni.`,
      { title: 'Elimina progetto', confirmLabel: 'Elimina progetto' },
    );
    if (!confirmed) return;
    this.deletingId.set(project.id);
    try {
      await firstValueFrom(
        this.http.delete(`/api/v1/workspaces/${workspaceId}/projects/${project.id}`),
      );
      this.projectEditor.set(null);
      this.selectedDetail.set(null);
      await this.load(workspaceId, 'projects');
      this.ui.notify('Progetto eliminato');
    } catch (error) {
      this.error.set(this.message(error));
    } finally {
      this.deletingId.set(null);
    }
  }

  protected projectClientName(project: Project): string {
    return (
      this.clients().find((client) => client.id === project.clientId)?.name ?? 'Nessun cliente'
    );
  }

  protected shareProject(project: Project): void {
    this.shareTarget.set({
      kind: 'project',
      id: project.id,
      projectId: project.id,
      name: project.name,
      clientId: project.clientId,
    });
  }

  protected async personalLink(client: Client): Promise<void> {
    const workspaceId = this.workspaces.current()?.workspace.id;
    if (!workspaceId) return;
    try {
      const result = await firstValueFrom(
        this.http.post<{ url: string }>(
          `/api/v1/workspaces/${workspaceId}/clients/${client.id}/personal-link`,
          {},
        ),
      );
      await navigator.clipboard.writeText(`${location.origin}${result.url}`);
      this.ui.notify('Link personale copiato e inviato via email');
    } catch (error) {
      this.error.set(this.message(error));
    }
  }

  protected openClient(client: Client): void {
    const projects = this.projects().filter((project) => project.clientId === client.id);
    this.selectedDetail.set({
      kind: 'client',
      title: client.name,
      subtitle: 'Cliente del workspace',
      fields: [
        { label: 'Email', value: client.email ?? 'Non configurata' },
        { label: 'Progetti collegati', value: String(projects.length) },
        {
          label: 'Elenco progetti',
          value: projects.length ? projects.map((project) => project.name).join(', ') : 'Nessuno',
        },
      ],
      client,
    });
  }

  protected clientProjectCount(clientId: string): number {
    return this.projects().filter((project) => project.clientId === clientId).length;
  }

  protected async deleteClient(client: Client): Promise<void> {
    const workspaceId = this.workspaces.current()?.workspace.id;
    if (!workspaceId || this.deletingId()) return;
    const projectCount = this.clientProjectCount(client.id);
    const confirmed = await this.dialogs.confirm(
      `Eliminare il cliente “${client.name}”? ${projectCount ? `I suoi ${projectCount} progetti resteranno disponibili senza cliente associato.` : 'I progetti non saranno modificati.'} Il link personale verrà disattivato.`,
      { title: 'Elimina cliente', confirmLabel: 'Elimina cliente' },
    );
    if (!confirmed) return;
    this.deletingId.set(client.id);
    try {
      await firstValueFrom(
        this.http.delete(`/api/v1/workspaces/${workspaceId}/clients/${client.id}`),
      );
      this.selectedDetail.set(null);
      await this.load(workspaceId, 'clients');
      this.ui.notify('Cliente eliminato');
    } catch (error) {
      this.error.set(this.message(error));
    } finally {
      this.deletingId.set(null);
    }
  }

  protected async openDelivery(delivery: Delivery): Promise<void> {
    const workspaceId = this.workspaces.current()?.workspace.id;
    if (!workspaceId) return;
    this.deliveryActivity.set(null);
    this.selectedDetail.set({
      kind: 'delivery',
      title: delivery.title,
      subtitle: 'Dettaglio consegna',
      fields: [
        {
          label: 'Stato',
          value: this.deliveryStatusLabel(delivery.status),
          tone:
            delivery.status === 'revoked'
              ? 'negative'
              : delivery.status === 'active'
                ? 'positive'
                : undefined,
        },
        { label: 'Download completati', value: String(delivery.completedDownloads) },
        { label: 'One-shot', value: delivery.oneShot ? 'Sì' : 'No' },
        { label: 'Scadenza', value: delivery.expiresAt ?? 'Nessuna scadenza' },
      ],
      delivery,
    });
    try {
      this.deliveryActivity.set(
        await firstValueFrom(
          this.http.get<DeliveryActivity>(
            `/api/v1/workspaces/${workspaceId}/deliveries/${delivery.id}/activity`,
          ),
        ),
      );
    } catch (error) {
      this.error.set(this.message(error));
    }
  }

  protected async copyDeliveryLink(delivery: Delivery, event?: Event): Promise<void> {
    event?.stopPropagation();
    if (!delivery.url) {
      this.ui.notify('Link storico non recuperabile: condividi nuovamente il contenuto.');
      return;
    }
    await navigator.clipboard.writeText(`${location.origin}${delivery.url}`);
    this.ui.notify('Link di consegna copiato');
  }

  protected async revokeDelivery(delivery: Delivery): Promise<void> {
    const workspaceId = this.workspaces.current()?.workspace.id;
    if (!workspaceId) return;
    const confirmed = await this.dialogs.confirm(`Revocare il link “${delivery.title}”?`, {
      title: 'Revoca consegna',
      confirmLabel: 'Revoca link',
    });
    if (!confirmed) return;
    await firstValueFrom(
      this.http.delete(`/api/v1/workspaces/${workspaceId}/deliveries/${delivery.id}`),
    );
    this.selectedDetail.set(null);
    await this.load(workspaceId, 'deliveries');
    this.ui.notify('Link revocato');
  }

  protected async deleteDelivery(delivery: Delivery, event?: Event): Promise<void> {
    event?.stopPropagation();
    const workspaceId = this.workspaces.current()?.workspace.id;
    if (!workspaceId || this.deletingId()) return;
    const confirmed = await this.dialogs.confirm(
      `Eliminare definitivamente il link “${delivery.title}”? Verranno rimossi anche commenti e approvazioni collegati.`,
      { title: 'Elimina link', confirmLabel: 'Elimina link' },
    );
    if (!confirmed) return;
    this.deletingId.set(delivery.id);
    try {
      await firstValueFrom(
        this.http.delete(`/api/v1/workspaces/${workspaceId}/deliveries/${delivery.id}/permanent`),
      );
      this.selectedDetail.set(null);
      await this.load(workspaceId, 'deliveries');
      this.ui.notify('Link eliminato');
    } catch (error) {
      this.error.set(this.message(error));
    } finally {
      this.deletingId.set(null);
    }
  }

  protected deliveryStatusLabel(status: string): string {
    return (
      {
        active: 'Attivo',
        revoked: 'Revocato',
        expired: 'Scaduto',
        draft: 'Bozza',
      }[status] ?? status
    );
  }

  protected openInvite(invite: Invite): void {
    const project = this.projects().find((item) => item.id === invite.projectId);
    this.selectedDetail.set({
      kind: 'invite',
      title: invite.email,
      subtitle: 'Invito collaboratore',
      fields: [
        { label: 'Ruolo', value: invite.role },
        { label: 'Scadenza', value: invite.expiresAt },
        {
          label: 'Ambito',
          value: invite.nodeId
            ? `${invite.scopeKind === 'file' ? 'File' : 'Cartella'}: ${invite.scopeName ?? 'contenuto selezionato'}`
            : (project?.name ?? 'Workspace'),
        },
        {
          label: 'Stato',
          value: invite.acceptedAt ? 'Accettato' : invite.revokedAt ? 'Revocato' : 'In attesa',
        },
      ],
    });
  }

  protected async revokeInvite(invite: Invite, event?: Event): Promise<void> {
    event?.stopPropagation();
    const workspaceId = this.workspaces.current()?.workspace.id;
    if (!workspaceId) return;
    const confirmed = await this.dialogs.confirm(`Revocare l’invito per ${invite.email}?`, {
      title: 'Revoca invito',
      confirmLabel: 'Revoca accesso',
    });
    if (!confirmed) return;
    await firstValueFrom(
      this.http.delete(`/api/v1/workspaces/${workspaceId}/collaboration-invites/${invite.id}`),
    );
    await this.load(workspaceId, this.section());
    this.ui.notify('Invito collaboratore revocato');
  }

  protected async savePortfolio(workspaceId?: string, publish = false): Promise<void> {
    workspaceId ??= this.workspaces.current()?.workspace.id;
    const current = this.portfolio();
    if (!workspaceId || !current) return;
    try {
      await firstValueFrom(
        this.http.patch(`/api/v1/workspaces/${workspaceId}/portfolio`, {
          slug: current.slug,
          document: {
            ...current.draft,
            identity: {
              ...current.draft.identity,
              title: this.portfolioName,
              tagline: this.portfolioTagline,
              about: this.portfolioAbout,
              logoUrl: this.portfolioLogoUrl,
              logoNodeId: this.portfolioLogoNodeId,
            },
            cta: { label: this.portfolioCtaLabel, url: this.portfolioCtaHref() },
            contact: {
              email: this.portfolioEmail,
              phone: this.portfolioPhone,
              location: this.portfolioLocation,
            },
            socials: this.portfolioSocials,
            media: this.portfolioMedia,
          },
        }),
      );
      if (publish)
        await firstValueFrom(
          this.http.post(`/api/v1/workspaces/${workspaceId}/portfolio/publish`, {}),
        );
      this.ui.notify(publish ? 'Portfolio pubblicato' : 'Bozza salvata');
    } catch (error) {
      this.error.set(this.message(error));
    }
  }

  protected addPortfolioSocial(): void {
    this.portfolioSocials = [...this.portfolioSocials, { label: '', url: '' }];
  }

  protected removePortfolioSocial(index: number): void {
    this.portfolioSocials = this.portfolioSocials.filter((_, itemIndex) => itemIndex !== index);
  }

  protected addPortfolioMedia(type: 'image' | 'video'): void {
    this.portfolioMedia = [
      ...this.portfolioMedia,
      { id: crypto.randomUUID(), type, url: '', alt: '', caption: '' },
    ];
  }

  protected removePortfolioMedia(id: string): void {
    this.portfolioMedia = this.portfolioMedia.filter((asset) => asset.id !== id);
  }

  protected setPortfolioCtaKind(kind: 'link' | 'whatsapp' | 'email'): void {
    if (this.portfolioCtaKind === kind) return;
    this.portfolioCtaKind = kind;
    this.portfolioCtaTarget = '';
  }

  protected portfolioCtaPrefix(): string {
    if (this.portfolioCtaKind === 'whatsapp') return 'wa.me/';
    if (this.portfolioCtaKind === 'email') return 'mailto:';
    return 'https://';
  }

  protected portfolioCtaGuide(): string {
    if (this.portfolioCtaKind === 'whatsapp')
      return 'Inserisci il numero con prefisso internazionale, senza + o spazi. Esempio: 393331234567.';
    if (this.portfolioCtaKind === 'email')
      return 'Inserisci soltanto l’indirizzo email. Esempio: studio@esempio.it.';
    return 'Inserisci il dominio o l’indirizzo completo. Esempio: tuosito.it/contatti.';
  }

  protected portfolioCtaHref(): string {
    const value = this.portfolioCtaTarget.trim();
    if (!value) return '';
    if (this.portfolioCtaKind === 'email') return `mailto:${value.replace(/^mailto:/i, '')}`;
    if (this.portfolioCtaKind === 'whatsapp') {
      const number = value.replace(/\D/g, '');
      return number ? `https://wa.me/${number}` : '';
    }
    return /^https?:\/\//i.test(value) ? value : `https://${value}`;
  }

  protected portfolioLogoPreviewUrl(): string {
    if (this.portfolioLogoNodeId) return this.portfolioDriveUrl(this.portfolioLogoNodeId);
    return this.portfolioLogoUrl;
  }

  protected portfolioMediaUrl(asset: { url: string; nodeId?: string }): string {
    return asset.nodeId ? this.portfolioDriveUrl(asset.nodeId) : asset.url;
  }

  protected clearPortfolioLogo(): void {
    this.portfolioLogoNodeId = '';
    this.portfolioLogoUrl = '';
  }

  protected async uploadPortfolioLogo(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      this.error.set('Il logo deve essere un’immagine.');
      return;
    }
    this.portfolioUploading.set(true);
    try {
      const nodeId = await this.uploadPortfolioFile(file);
      this.portfolioLogoNodeId = nodeId;
      this.portfolioLogoUrl = '';
      this.ui.notify('Logo caricato nel Drive');
    } catch (error) {
      this.error.set(this.message(error));
    } finally {
      this.portfolioUploading.set(false);
    }
  }

  protected async uploadPortfolioMedia(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = [...(input.files ?? [])];
    input.value = '';
    if (!files.length) return;
    this.portfolioUploading.set(true);
    try {
      for (const file of files) {
        if (!file.type.startsWith('image/') && !file.type.startsWith('video/'))
          throw new Error(`${file.name}: seleziona soltanto foto o video.`);
        const nodeId = await this.uploadPortfolioFile(file);
        this.portfolioMedia = [
          ...this.portfolioMedia,
          {
            id: crypto.randomUUID(),
            type: file.type.startsWith('video/') ? 'video' : 'image',
            url: '',
            nodeId,
            alt: file.name.replace(/\.[^.]+$/, ''),
            caption: '',
          },
        ];
      }
      this.ui.notify(files.length === 1 ? 'Media caricato nel Drive' : 'Media caricati nel Drive');
    } catch (error) {
      this.error.set(this.message(error));
    } finally {
      this.portfolioUploading.set(false);
    }
  }

  protected portfolioPublicUrl(): string {
    const slug = this.portfolio()?.slug;
    return slug ? `${location.origin}/p/${slug}` : '';
  }

  protected async copyPortfolioLink(): Promise<void> {
    const url = this.portfolioPublicUrl();
    if (!url) return;
    await navigator.clipboard.writeText(url);
    this.ui.notify('Link pubblico copiato');
  }

  protected async wipe(): Promise<void> {
    const current = this.workspaces.current();
    if (!current) return;
    const confirmation = await this.dialogs.prompt(
      `Digita ${current.workspace.name} per eliminare tutti i dati senza scaricarli`,
      { title: 'Svuota workspace', confirmLabel: 'Svuota definitivamente' },
    );
    if (confirmation !== current.workspace.name) return;
    await firstValueFrom(
      this.http.post(`/api/v1/account/workspaces/${current.workspace.id}/wipe`, {}),
    );
    await this.workspaces.load();
    this.ui.notify('Workspace svuotato e riattivato sul piano Free');
  }

  protected planPrice(plan: BillingPlan): string {
    const amount = this.billingAnnual() ? plan.annual : plan.monthly;
    return amount.toLocaleString('it-IT', { minimumFractionDigits: amount % 1 ? 2 : 0 });
  }

  protected annualMonthlyEquivalent(plan: BillingPlan): string {
    return (plan.annual / 12).toLocaleString('it-IT', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  protected planName(plan: BillingPlan['id']): string {
    if (plan === 'unlimited') return 'Unlimited';
    if (plan === 'pro') return 'Pro';
    return 'Free';
  }

  protected isCurrentPlan(plan: BillingPlan['id']): boolean {
    return this.billing()?.plan === plan;
  }

  protected async choosePlan(plan: 'pro' | 'unlimited'): Promise<void> {
    const workspaceId = this.workspaces.current()?.workspace.id;
    const billing = this.billing();
    if (!workspaceId || !billing) return;
    if (billing.subscription && ['active', 'trialing'].includes(billing.subscription.status)) {
      this.manageBilling();
      return;
    }
    const catalog = this.billingCatalog();
    if (catalog?.provider !== 'stripe' || !catalog.publishableKey) {
      this.error.set(
        'Stripe non è ancora configurato: imposta provider, chiavi e Price ID nel file .env.',
      );
      return;
    }
    this.checkoutLoading.set(true);
    this.checkoutPlan.set(plan);
    this.error.set('');
    try {
      const result = await firstValueFrom(
        this.http.post<{ clientSecret?: string }>(
          `/api/v1/billing/workspaces/${workspaceId}/checkout`,
          { plan, annual: this.billingAnnual() },
        ),
      );
      if (!result.clientSecret) throw new Error('Checkout Stripe incorporato non disponibile.');
      this.checkoutOpen.set(true);
      await new Promise((resolve) => setTimeout(resolve));
      const stripe = await this.loadStripe(catalog.publishableKey);
      this.embeddedCheckout = await stripe.initEmbeddedCheckout({
        fetchClientSecret: async () => result.clientSecret as string,
        onComplete: () => {
          this.closeCheckout();
          this.ui.notify('Pagamento ricevuto. Il piano si aggiorna dopo la conferma Stripe.');
          setTimeout(() => void this.load(workspaceId, 'settings'), 1200);
        },
      });
      this.embeddedCheckout.mount('#stripe-embedded-checkout');
    } catch (error) {
      this.checkoutOpen.set(false);
      this.checkoutPlan.set(null);
      this.error.set(this.message(error));
    } finally {
      this.checkoutLoading.set(false);
    }
  }

  protected closeCheckout(): void {
    this.destroyEmbeddedCheckout();
    this.checkoutOpen.set(false);
    this.checkoutPlan.set(null);
  }

  protected openCustomerPortal(): void {
    if (this.workspaces.current()?.workspace.id) this.manageBilling();
  }

  private async load(workspaceId: string, section: Section): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      if (
        section === 'projects' ||
        section === 'clients' ||
        section === 'deliveries' ||
        section === 'portfolio'
      )
        this.projects.set(
          await firstValueFrom(
            this.http.get<Project[]>(`/api/v1/workspaces/${workspaceId}/projects`),
          ),
        );
      if (section === 'projects' || section === 'clients' || section === 'deliveries')
        this.clients.set(
          await firstValueFrom(
            this.http.get<Client[]>(`/api/v1/workspaces/${workspaceId}/clients`),
          ),
        );
      if (section === 'deliveries')
        this.deliveries.set(
          await firstValueFrom(
            this.http.get<Delivery[]>(`/api/v1/workspaces/${workspaceId}/deliveries`),
          ),
        );
      if (section === 'team' || section === 'deliveries')
        this.invites.set(
          await firstValueFrom(
            this.http.get<Invite[]>(`/api/v1/workspaces/${workspaceId}/collaboration-invites`),
          ),
        );
      if (section === 'portfolio') {
        const site = await firstValueFrom(
          this.http.get<Portfolio>(`/api/v1/workspaces/${workspaceId}/portfolio`),
        );
        this.portfolio.set(site);
        this.portfolioName = site.draft.identity.title;
        this.portfolioTagline = site.draft.identity.tagline;
        this.portfolioAbout = site.draft.identity.about ?? '';
        this.portfolioLogoUrl = site.draft.identity.logoUrl ?? '';
        this.portfolioLogoNodeId = site.draft.identity.logoNodeId ?? '';
        this.portfolioCtaLabel = site.draft.cta?.label ?? '';
        this.readPortfolioCta(site.draft.cta?.url ?? '');
        this.portfolioEmail = site.draft.contact?.email ?? '';
        this.portfolioPhone = site.draft.contact?.phone ?? '';
        this.portfolioLocation = site.draft.contact?.location ?? '';
        this.portfolioSocials = site.draft.socials?.map((social) => ({ ...social })) ?? [];
        this.portfolioMedia = site.draft.media?.map((asset) => ({ ...asset })) ?? [];
      }
      if (section === 'settings') {
        const [billing, catalog] = await Promise.all([
          firstValueFrom(this.http.get<Billing>(`/api/v1/billing/workspaces/${workspaceId}`)),
          firstValueFrom(this.http.get<BillingCatalog>('/api/v1/billing/catalog')),
        ]);
        this.billing.set(billing);
        this.billingCatalog.set(catalog);
        this.billingAnnual.set(billing.subscription?.billingInterval === 'annual');
      }
    } catch (error) {
      this.error.set(this.message(error));
    } finally {
      this.loading.set(false);
    }
  }

  private readPortfolioCta(url: string): void {
    if (url.startsWith('mailto:')) {
      this.portfolioCtaKind = 'email';
      this.portfolioCtaTarget = url.slice(7);
      return;
    }
    const whatsapp = /^https?:\/\/(?:www\.)?wa\.me\/(.+)$/i.exec(url);
    if (whatsapp) {
      this.portfolioCtaKind = 'whatsapp';
      this.portfolioCtaTarget = whatsapp[1];
      return;
    }
    this.portfolioCtaKind = 'link';
    this.portfolioCtaTarget = url.replace(/^https?:\/\//i, '');
  }

  private portfolioDriveUrl(nodeId: string): string {
    const workspaceId = this.workspaces.current()?.workspace.id;
    return workspaceId ? `/api/v1/workspaces/${workspaceId}/portfolio/media/${nodeId}` : '';
  }

  private async uploadPortfolioFile(file: File): Promise<string> {
    const workspaceId = this.workspaces.current()?.workspace.id;
    const project = this.projects()[0];
    if (!workspaceId || !project)
      throw new Error('Crea prima un progetto: i media del portfolio vengono salvati nel Drive.');
    this.error.set('');
    this.portfolioUploadProgress.set(0);
    const created = await firstValueFrom(
      this.http.post<{ id: string }>(
        `/api/v1/workspaces/${workspaceId}/projects/${project.id}/files/uploads`,
        {
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          size: file.size,
        },
      ),
    );
    const csrf = this.cookie('ph_csrf');
    const authHeaders: Record<string, string> = csrf ? { 'x-csrf-token': csrf } : {};
    const head = await fetch(`/api/v1/uploads/${created.id}`, {
      method: 'HEAD',
      credentials: 'include',
      headers: authHeaders,
    });
    if (!head.ok) throw new Error('Sessione upload non disponibile.');
    let offset = Number(head.headers.get('Upload-Offset') ?? 0);
    const chunkSize = 8 * 1024 * 1024;
    while (offset < file.size) {
      const chunk = file.slice(offset, Math.min(offset + chunkSize, file.size));
      const response = await fetch(`/api/v1/uploads/${created.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          ...authHeaders,
          'Upload-Offset': String(offset),
          'Content-Type': 'application/offset+octet-stream',
        },
        body: chunk,
      });
      if (!response.ok) {
        if (response.status === 413)
          throw new Error('Chunk rifiutato dal gateway: limite proxy non configurato.');
        throw new Error('Upload interrotto: puoi riprenderlo entro 12 ore dal Drive.');
      }
      offset = Number(response.headers.get('Upload-Offset') ?? offset + chunk.size);
      this.portfolioUploadProgress.set(Math.min(85, Math.round((offset / file.size) * 85)));
    }
    for (let attempt = 0; attempt < 190; attempt += 1) {
      const response = await fetch(`/api/v1/uploads/${created.id}`, {
        method: 'HEAD',
        credentials: 'include',
        headers: authHeaders,
      });
      const status = response.headers.get('Upload-Status');
      const nodeId = response.headers.get('Upload-File-Node-Id');
      if (response.ok && status === 'completed' && nodeId) {
        this.portfolioUploadProgress.set(100);
        return nodeId;
      }
      if (!response.ok || status === 'failed')
        throw new Error('Elaborazione del file non riuscita.');
      this.portfolioUploadProgress.set(
        Math.min(99, Math.round(85 + 14 * (1 - Math.exp(-(attempt + 1) / 12)))),
      );
      await new Promise((resolve) => setTimeout(resolve, Math.min(1000 + attempt * 250, 10_000)));
    }
    throw new Error('Elaborazione ancora in corso: ritroverai il file nel Drive.');
  }

  private manageBilling(): void {
    window.open(BILLING_PORTAL_URL, '_blank', 'noopener,noreferrer');
  }

  private loadStripe(publishableKey: string): Promise<StripeClient> {
    if (this.stripeLoader) return this.stripeLoader;
    this.stripeLoader = new Promise<StripeClient>((resolve, reject) => {
      const initialize = () => {
        if (!window.Stripe) {
          reject(new Error('Stripe.js non disponibile.'));
          return;
        }
        resolve(window.Stripe(publishableKey));
      };
      if (window.Stripe) {
        initialize();
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://js.stripe.com/clover/stripe.js';
      script.async = true;
      script.onload = initialize;
      script.onerror = () => reject(new Error('Impossibile caricare il pagamento sicuro Stripe.'));
      document.head.append(script);
    });
    return this.stripeLoader;
  }

  private destroyEmbeddedCheckout(): void {
    this.embeddedCheckout?.destroy();
    this.embeddedCheckout = null;
  }

  private message(error: unknown): string {
    const value = error as { error?: { message?: string } };
    return (
      value.error?.message ?? (error instanceof Error ? error.message : 'Operazione non riuscita')
    );
  }

  private cookie(name: string): string | null {
    const prefix = `${name}=`;
    const row = document.cookie.split('; ').find((item) => item.startsWith(prefix));
    return row ? decodeURIComponent(row.slice(prefix.length)) : null;
  }
}
