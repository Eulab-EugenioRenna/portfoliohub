import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, computed, HostListener, inject, OnDestroy, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { AppendToBody } from './append-to-body';
import { CustomSelect, type SelectOption } from './custom-select';
import { DialogHost, DialogService } from './dialog';

interface Staff {
  displayName: string;
  email: string;
  role: string;
}
interface Overview {
  users: string;
  workspaces: string;
  suspended: string;
  active_uploads: string;
  queued_finalizations: string;
  active_finalizations: string;
  failed_finalizations: string;
  failed_emails: string;
  legal_holds: string;
}
interface Workspace {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  type: string;
  createdAt: string;
  stats: { projects: string; members: string; bytes: string };
}
interface ServiceCheck {
  key: string;
  label: string;
  status: 'up' | 'down';
  latencyMs: number;
  detail: string;
}
interface StaffAudit {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  reason: string;
  createdAt: string;
}
interface SupportTicket {
  id: string;
  workspaceId: string;
  subject: string;
  category: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'waiting_user' | 'resolved' | 'closed';
  description: string;
  updatedAt: string;
}
interface TicketMessage {
  id: string;
  authorType: 'user' | 'staff';
  body: string;
  createdAt: string;
}
interface StaffNotification {
  id: string;
  title: string;
  body: string;
  actionUrl: string | null;
  readAt: string | null;
  createdAt: string;
}
interface AccountWorkspace {
  id: string;
  name: string;
  plan: 'free' | 'pro' | 'unlimited';
  status: string;
}
interface Account {
  id: string;
  email: string;
  displayName: string;
  status: 'pending' | 'active' | 'suspended' | 'deleting';
  emailVerifiedAt: string | null;
  createdAt: string;
  workspaces: AccountWorkspace[];
}
type AdminView = 'overview' | 'accounts' | 'workspaces' | 'security' | 'operations' | 'tickets';

const VIEW_META: Record<AdminView, { eyebrow: string; title: string; description: string }> = {
  overview: {
    eyebrow: 'CONTROL PLANE',
    title: 'Stato della piattaforma',
    description: 'Panoramica sintetica dei servizi e delle aree che richiedono attenzione.',
  },
  workspaces: {
    eyebrow: 'TENANT OPERATIONS',
    title: 'Workspace',
    description: 'Ricerca e gestione operativa dei workspace senza esposizione dei contenuti.',
  },
  accounts: {
    eyebrow: 'IDENTITY OPERATIONS',
    title: 'Account',
    description: 'Creazione, verifica e assegnazione manuale dei piani con audit obbligatorio.',
  },
  security: {
    eyebrow: 'TRUST & SAFETY',
    title: 'Sicurezza',
    description: 'Sospensioni, legal hold e accessi di supporto sottoposti ad audit.',
  },
  operations: {
    eyebrow: 'PLATFORM OPERATIONS',
    title: 'Operazioni',
    description: 'Stato di upload, comunicazioni e processi tecnici della piattaforma.',
  },
  tickets: {
    eyebrow: 'SUPPORT DESK',
    title: 'Ticket',
    description: 'Richieste inviate dai workspace, priorità e stato di lavorazione.',
  },
};

@Component({
  selector: 'app-root',
  imports: [CommonModule, FormsModule, AppendToBody, CustomSelect, DialogHost],
  templateUrl: './app.html',
})
export class App implements OnDestroy {
  private readonly dialogs = inject(DialogService);
  private readonly http = inject(HttpClient);
  readonly staff = signal<Staff | null>(null);
  readonly overview = signal<Overview | null>(null);
  readonly workspaces = signal<Workspace[]>([]);
  readonly accounts = signal<Account[]>([]);
  readonly selected = signal<Workspace | null>(null);
  readonly selectedAccount = signal<Account | null>(null);
  readonly createAccountOpen = signal(false);
  readonly services = signal<ServiceCheck[]>([]);
  readonly auditEvents = signal<StaffAudit[]>([]);
  readonly tickets = signal<SupportTicket[]>([]);
  readonly notifications = signal<StaffNotification[]>([]);
  readonly notificationPanelOpen = signal(false);
  readonly unreadNotifications = computed(
    () => this.notifications().filter((item) => !item.readAt).length,
  );
  readonly selectedTicket = signal<SupportTicket | null>(null);
  readonly ticketMessages = signal<TicketMessage[]>([]);
  readonly ticketConversationLoading = signal(false);
  readonly ticketReplySending = signal(false);
  readonly servicesCheckedAt = signal<string | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly sidebarCollapsed = signal(false);
  readonly activeView = signal<AdminView>(this.viewFromHash());
  readonly activeViewMeta = computed(() => VIEW_META[this.activeView()]);
  readonly servicesOperational = computed(
    () => this.services().filter((service) => service.status === 'up').length,
  );
  readonly hasServiceDown = computed(() =>
    this.services().some((service) => service.status === 'down'),
  );
  readonly openTicketCount = computed(
    () => this.tickets().filter((ticket) => ['open', 'in_progress'].includes(ticket.status)).length,
  );
  email = '';
  password = '';
  query = '';
  accountQuery = '';
  reason = '';
  accountReason = '';
  accountPlan: 'free' | 'pro' | 'unlimited' = 'pro';
  accountWorkspaceId = '';
  ticketReply = '';
  private ticketEventSource: EventSource | null = null;
  readonly workspaceTypeOptions: SelectOption[] = [
    { value: 'freelance', label: 'Freelance' },
    { value: 'studio', label: 'Studio' },
  ];
  readonly planOptions: SelectOption[] = [
    { value: 'free', label: 'Free' },
    { value: 'pro', label: 'Pro' },
    { value: 'unlimited', label: 'Unlimited' },
  ];
  readonly ticketStatusOptions: SelectOption[] = [
    { value: 'open', label: 'Aperto' },
    { value: 'in_progress', label: 'In lavorazione' },
    { value: 'waiting_user', label: 'In attesa utente' },
    { value: 'resolved', label: 'Risolto' },
    { value: 'closed', label: 'Chiuso' },
  ];
  newAccount = {
    email: '',
    displayName: '',
    password: '',
    workspaceName: '',
    workspaceType: 'freelance' as 'freelance' | 'studio',
  };
  readonly initials = computed(
    () =>
      this.staff()
        ?.displayName.split(/\s+/)
        .map((word) => word[0])
        .join('')
        .slice(0, 2)
        .toUpperCase() ?? 'PH',
  );

  constructor() {
    this.restore();
  }

  ngOnDestroy(): void {
    this.ticketEventSource?.close();
  }

  login(): void {
    this.error.set('');
    this.loading.set(true);
    this.http
      .post<Staff>('/api/v1/admin/auth/login', { email: this.email, password: this.password })
      .subscribe({
        next: (staff) => {
          this.staff.set(staff);
          this.password = '';
          this.load();
        },
        error: () => {
          this.error.set('Credenziali non valide o servizio non disponibile.');
          this.loading.set(false);
        },
      });
  }

  logout(): void {
    this.error.set('');
    this.http.post('/api/v1/admin/auth/logout', {}).subscribe({
      next: () => {
        this.staff.set(null);
        this.overview.set(null);
        this.workspaces.set([]);
        this.accounts.set([]);
      },
      error: () => this.error.set('Disconnessione non riuscita. Riprova.'),
    });
  }

  toggleSidebar(): void {
    this.sidebarCollapsed.update((collapsed) => !collapsed);
  }

  navigate(view: AdminView, event?: Event): void {
    event?.preventDefault();
    if (this.activeView() === view) return;
    this.activeView.set(view);
    window.history.pushState(null, '', `#${view}`);
  }

  @HostListener('window:hashchange')
  syncViewFromUrl(): void {
    this.activeView.set(this.viewFromHash());
  }

  @HostListener('document:click', ['$event'])
  closeNotificationsOnOutsideClick(event: MouseEvent): void {
    const target = event.target;
    if (
      target instanceof Element &&
      target.closest('.admin-notification-area, [data-admin-header-overlay][data-body-overlay]')
    )
      return;
    this.notificationPanelOpen.set(false);
  }

  async toggleNotifications(): Promise<void> {
    const open = !this.notificationPanelOpen();
    this.notificationPanelOpen.set(open);
    if (!open) return;
    try {
      this.notifications.set(
        await firstValueFrom(this.http.get<StaffNotification[]>('/api/v1/admin/notifications')),
      );
    } catch {
      this.error.set('Impossibile caricare le notifiche staff.');
    }
  }

  async openNotification(item: StaffNotification): Promise<void> {
    if (!item.readAt) {
      await firstValueFrom(this.http.patch(`/api/v1/admin/notifications/${item.id}/read`, {}));
      this.notifications.update((items) =>
        items.map((current) =>
          current.id === item.id ? { ...current, readAt: new Date().toISOString() } : current,
        ),
      );
    }
    this.notificationPanelOpen.set(false);
    this.navigate('tickets');
  }

  search(): void {
    this.http
      .get<Workspace[]>('/api/v1/admin/workspaces', { params: this.query ? { q: this.query } : {} })
      .subscribe({
        next: (items) => this.workspaces.set(items),
        error: () => this.error.set('Impossibile caricare i workspace.'),
      });
  }

  searchAccounts(): void {
    this.http
      .get<Account[]>('/api/v1/admin/accounts', {
        params: this.accountQuery ? { q: this.accountQuery } : {},
      })
      .subscribe({
        next: (items) => this.accounts.set(items),
        error: () => this.error.set('Impossibile caricare gli account.'),
      });
  }

  openAccount(account: Account): void {
    this.selectedAccount.set(account);
    this.accountWorkspaceId = account.workspaces[0]?.id ?? '';
    this.accountPlan = account.workspaces[0]?.plan ?? 'pro';
    this.accountReason = '';
  }

  workspaceOptions(account: Account): SelectOption[] {
    return account.workspaces.map((workspace) => ({
      value: workspace.id,
      label: workspace.name,
      description: `Piano ${workspace.plan}`,
    }));
  }

  createAccount(): void {
    this.error.set('');
    this.http.post('/api/v1/admin/accounts', this.newAccount).subscribe({
      next: () => {
        this.createAccountOpen.set(false);
        this.newAccount = {
          email: '',
          displayName: '',
          password: '',
          workspaceName: '',
          workspaceType: 'freelance',
        };
        this.searchAccounts();
        this.loadOverview();
      },
      error: (error) => this.error.set(error.error?.message ?? 'Creazione account non riuscita.'),
    });
  }

  verifyAccount(): void {
    const account = this.selectedAccount();
    if (!account || this.accountReason.trim().length < 20) {
      this.error.set('Inserisci una motivazione di almeno 20 caratteri.');
      return;
    }
    this.http
      .post(`/api/v1/admin/accounts/${account.id}/verify`, { reason: this.accountReason })
      .subscribe({
        next: () => this.refreshSelectedAccount(account.id),
        error: (error) => this.error.set(error.error?.message ?? 'Verifica manuale non riuscita.'),
      });
  }

  async assignAccountPlan(): Promise<void> {
    const account = this.selectedAccount();
    if (!account || !this.accountWorkspaceId || this.accountReason.trim().length < 20) {
      this.error.set('Seleziona un workspace e inserisci una motivazione di almeno 20 caratteri.');
      return;
    }
    const confirmed = await this.dialogs.confirm(
      `Assegnare il piano ${this.accountPlan} senza pagamento?`,
      { title: 'Promozione manuale', confirmLabel: 'Assegna piano' },
    );
    if (!confirmed) return;
    this.http
      .post(`/api/v1/admin/workspaces/${this.accountWorkspaceId}/manual-plan`, {
        plan: this.accountPlan,
        reason: this.accountReason,
      })
      .subscribe({
        next: () => this.refreshSelectedAccount(account.id),
        error: (error) =>
          this.error.set(error.error?.message ?? 'Assegnazione manuale non riuscita.'),
      });
  }

  async suspend(): Promise<void> {
    const workspace = this.selected();
    if (!workspace || this.reason.trim().length < 20) {
      this.error.set('Inserisci una motivazione di almeno 20 caratteri.');
      return;
    }
    const confirmed = await this.dialogs.confirm(
      `Sospendere ${workspace.name}? Il purge è programmato dopo 7 giorni.`,
      { title: 'Sospendi workspace', confirmLabel: 'Sospendi' },
    );
    if (!confirmed) return;
    this.http
      .post(`/api/v1/admin/workspaces/${workspace.id}/suspend`, { reason: this.reason })
      .subscribe({
        next: () => {
          this.reason = '';
          this.selected.set(null);
          this.load();
        },
        error: (error) => this.error.set(error.error?.message ?? 'Operazione non riuscita.'),
      });
  }

  legalHold(): void {
    const workspace = this.selected();
    if (!workspace || this.reason.trim().length < 20) {
      this.error.set('Inserisci una motivazione di almeno 20 caratteri.');
      return;
    }
    this.http
      .post(`/api/v1/admin/workspaces/${workspace.id}/legal-holds`, { reason: this.reason })
      .subscribe({
        next: () => {
          this.reason = '';
          this.selected.set(null);
          this.load();
        },
        error: () => this.error.set('Legal hold non applicato.'),
      });
  }

  support(mode: 'read_only' | 'break_glass'): void {
    const workspace = this.selected();
    if (!workspace || this.reason.trim().length < 20) {
      this.error.set('Inserisci una motivazione di almeno 20 caratteri.');
      return;
    }
    this.http
      .post('/api/v1/admin/support-sessions', {
        workspaceId: workspace.id,
        reason: this.reason,
        mode,
      })
      .subscribe({
        next: () => {
          this.reason = '';
          this.selected.set(null);
        },
        error: () => this.error.set('Sessione di supporto non autorizzata.'),
      });
  }

  formatBytes(value: string): string {
    const gib = Math.ceil(Number(value) / 1024 ** 3);
    return `${gib.toLocaleString('it-IT')} GB`;
  }

  refreshServices(): void {
    this.http
      .get<{ checkedAt: string; checks: ServiceCheck[] }>('/api/v1/admin/services')
      .subscribe({
        next: (result) => {
          this.services.set(result.checks);
          this.servicesCheckedAt.set(result.checkedAt);
        },
        error: () => this.error.set('Impossibile verificare lo stato dei servizi.'),
      });
  }

  updateTicket(ticket: SupportTicket, status: SupportTicket['status']): void {
    this.http
      .patch<SupportTicket>(`/api/v1/admin/tickets/${ticket.id}`, {
        status,
        priority: ticket.priority,
      })
      .subscribe({
        next: (updated) => {
          this.tickets.update((items) =>
            items.map((item) => (item.id === updated.id ? updated : item)),
          );
          if (this.selectedTicket()?.id === updated.id) this.selectedTicket.set(updated);
        },
        error: () => this.error.set('Aggiornamento ticket non riuscito.'),
      });
  }

  async openTicket(ticket: SupportTicket): Promise<void> {
    this.selectedTicket.set(ticket);
    this.ticketMessages.set([]);
    this.ticketConversationLoading.set(true);
    this.ticketEventSource?.close();
    try {
      this.ticketMessages.set(
        await firstValueFrom(
          this.http.get<TicketMessage[]>(`/api/v1/admin/tickets/${ticket.id}/messages`),
        ),
      );
      this.connectTicketEvents(ticket.id);
    } catch {
      this.error.set('Impossibile caricare la conversazione.');
    } finally {
      this.ticketConversationLoading.set(false);
    }
  }

  closeTicket(): void {
    this.ticketEventSource?.close();
    this.ticketEventSource = null;
    this.selectedTicket.set(null);
    this.ticketMessages.set([]);
    this.ticketReply = '';
  }

  async replyToTicket(event: Event): Promise<void> {
    event.preventDefault();
    const ticket = this.selectedTicket();
    const body = this.ticketReply.trim();
    if (!ticket || !body || ticket.status === 'closed') return;
    this.ticketReplySending.set(true);
    try {
      const message = await firstValueFrom(
        this.http.post<TicketMessage>(`/api/v1/admin/tickets/${ticket.id}/messages`, { body }),
      );
      this.ticketMessages.update((items) => [...items, message]);
      this.ticketReply = '';
      this.tickets.update((items) =>
        items.map((item) =>
          item.id === ticket.id
            ? { ...item, status: 'waiting_user', updatedAt: message.createdAt }
            : item,
        ),
      );
      this.selectedTicket.update((current) =>
        current ? { ...current, status: 'waiting_user', updatedAt: message.createdAt } : current,
      );
    } catch (error) {
      const candidate = error as { error?: { message?: string } };
      this.error.set(candidate.error?.message ?? 'Invio risposta non riuscito.');
    } finally {
      this.ticketReplySending.set(false);
    }
  }

  private connectTicketEvents(ticketId: string): void {
    const source = new EventSource(`/api/v1/admin/tickets/${ticketId}/events`, {
      withCredentials: true,
    });
    source.onmessage = (event) => {
      const payload = JSON.parse(event.data) as { messages?: TicketMessage[] };
      if (payload.messages) this.ticketMessages.set(payload.messages);
    };
    source.onerror = () => {
      if (this.selectedTicket()?.id !== ticketId) source.close();
    };
    this.ticketEventSource = source;
  }

  ticketStatus(status: SupportTicket['status']): string {
    return {
      open: 'Aperto',
      in_progress: 'In lavorazione',
      waiting_user: 'In attesa utente',
      resolved: 'Risolto',
      closed: 'Chiuso',
    }[status];
  }

  accountStatusLabel(status: Account['status']): string {
    return {
      pending: 'In attesa',
      active: 'Attivo',
      suspended: 'Sospeso',
      deleting: 'In eliminazione',
    }[status];
  }

  private restore(): void {
    this.http.get<Staff>('/api/v1/admin/auth/me').subscribe({
      next: (staff) => {
        this.staff.set(staff);
        this.load();
      },
      error: () => this.loading.set(false),
    });
  }

  private viewFromHash(): AdminView {
    const hash = window.location.hash.slice(1);
    return ['overview', 'accounts', 'workspaces', 'security', 'operations', 'tickets'].includes(
      hash,
    )
      ? (hash as AdminView)
      : 'overview';
  }

  private load(): void {
    this.loading.set(true);
    this.error.set('');
    this.loadOverview();
    this.search();
    this.searchAccounts();
    this.refreshServices();
    this.http.get<StaffAudit[]>('/api/v1/admin/audit').subscribe({
      next: (events) => this.auditEvents.set(events),
      error: () => this.auditEvents.set([]),
    });
    this.http.get<SupportTicket[]>('/api/v1/admin/tickets').subscribe({
      next: (tickets) => this.tickets.set(tickets),
      error: () => this.tickets.set([]),
    });
    this.http.get<StaffNotification[]>('/api/v1/admin/notifications').subscribe({
      next: (items) => this.notifications.set(items),
      error: () => this.notifications.set([]),
    });
  }

  private loadOverview(): void {
    this.http.get<Overview>('/api/v1/admin/overview').subscribe({
      next: (overview) => {
        this.overview.set(overview);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Servizio amministrativo non disponibile.');
        this.loading.set(false);
      },
    });
  }

  private refreshSelectedAccount(id: string): void {
    this.accountReason = '';
    this.searchAccounts();
    this.http.get<Account[]>('/api/v1/admin/accounts').subscribe({
      next: (accounts) => {
        this.accounts.set(accounts);
        const refreshed = accounts.find((account) => account.id === id) ?? null;
        this.selectedAccount.set(refreshed);
        if (refreshed) {
          this.accountWorkspaceId = refreshed.workspaces[0]?.id ?? '';
          this.accountPlan = refreshed.workspaces[0]?.plan ?? 'pro';
        }
      },
    });
  }
}
