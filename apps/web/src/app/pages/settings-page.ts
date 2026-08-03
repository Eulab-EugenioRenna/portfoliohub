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
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthStore, type Principal } from '../core/auth.store';
import { BILLING_PORTAL_URL } from '../core/billing-portal';
import { UiStore } from '../core/ui-store';
import { WorkspaceStore } from '../core/workspace.store';
import { AppendToBody } from '../ui/append-to-body';
import {
  PhBadge,
  PhButton,
  PhCard,
  PhField,
  PhNoticeBanner,
  PhPasswordInput,
  PhSectionHeading,
  PhSkeleton,
} from '../ui/design-system';
import { DialogService } from '../ui/dialog.service';

type SettingsSection =
  | 'profile'
  | 'workspace'
  | 'security'
  | 'notifications'
  | 'plans'
  | 'data'
  | 'tutorial'
  | 'legal'
  | 'account';

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

interface Billing {
  plan: BillingPlan['id'];
  workspaceStatus: string;
  commercialUsage: { storageGb: number; trafficGb: number };
  subscription: {
    status: string;
    billingInterval: 'monthly' | 'annual' | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
  } | null;
}

interface NotificationPreferences {
  transactionalEmail: boolean;
  productEmail: boolean;
  massEmail: boolean;
  inAppBanner: boolean;
  ticketUpdates: boolean;
  deliveryActivity: boolean;
  workspaceActivity: boolean;
}

interface PrivacyRequest {
  id: string;
  kind: string;
  status: string;
  requestedAt: string;
  completedAt: string | null;
  resultKey: string | null;
}

interface DeletionRequest {
  id: string;
  requestedAt: string;
  scheduledFor: string;
}

interface AccountSession {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
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

@Component({
  selector: 'ph-settings-page',
  imports: [
    FormsModule,
    DatePipe,
    RouterLink,
    AppendToBody,
    PhBadge,
    PhButton,
    PhCard,
    PhField,
    PhNoticeBanner,
    PhPasswordInput,
    PhSectionHeading,
    PhSkeleton,
  ],
  templateUrl: './settings-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsPage implements OnDestroy {
  protected readonly auth = inject(AuthStore);
  protected readonly workspaces = inject(WorkspaceStore);
  protected readonly ui = inject(UiStore);
  private readonly http = inject(HttpClient);
  private readonly dialogs = inject(DialogService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fragment = toSignal(this.route.fragment, {
    initialValue: this.route.snapshot.fragment,
  });

  protected readonly sections: Array<{
    id: SettingsSection;
    label: string;
    description: string;
    icon: string;
  }> = [
    { id: 'profile', label: 'Profilo', description: 'Identità personale', icon: 'PR' },
    { id: 'workspace', label: 'Workspace', description: 'Nome e informazioni', icon: 'WS' },
    { id: 'security', label: 'Password', description: 'Credenziali e sessioni', icon: 'SI' },
    { id: 'notifications', label: 'Notifiche', description: 'Banner, centro ed email', icon: 'NO' },
    { id: 'plans', label: 'Piani', description: 'Quote e fatturazione', icon: 'PL' },
    { id: 'data', label: 'Dati e backup', description: 'Portabilità e pulizia', icon: 'DA' },
    { id: 'tutorial', label: 'Tutorial', description: 'Tour guidato', icon: 'TU' },
    { id: 'legal', label: 'Termini e privacy', description: 'Documenti legali', icon: 'LE' },
    { id: 'account', label: 'Account', description: 'Cancellazione', icon: 'AC' },
  ];
  protected readonly activeSection = signal<SettingsSection>('profile');
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly billing = signal<Billing | null>(null);
  protected readonly catalog = signal<BillingCatalog | null>(null);
  protected readonly preferences = signal<NotificationPreferences | null>(null);
  protected readonly privacyRequests = signal<PrivacyRequest[]>([]);
  protected readonly deletion = signal<DeletionRequest | null>(null);
  protected readonly sessions = signal<AccountSession[]>([]);
  protected readonly billingAnnual = signal(false);
  protected readonly checkoutOpen = signal(false);
  protected readonly checkoutPlan = signal<'pro' | 'unlimited' | null>(null);
  protected readonly currentPlan = computed(() => {
    const plan = this.billing()?.plan;
    return this.catalog()?.plans.find((item) => item.id === plan) ?? null;
  });

  protected readonly displayName = signal('');
  protected readonly workspaceName = signal('');
  protected readonly currentPassword = signal('');
  protected readonly newPassword = signal('');
  protected readonly confirmPassword = signal('');
  protected readonly deletionPassword = signal('');
  protected readonly passwordError = computed(() => {
    if (!this.newPassword() && !this.confirmPassword()) return '';
    if (this.newPassword().length < 12)
      return 'La nuova password deve contenere almeno 12 caratteri.';
    if (this.newPassword() !== this.confirmPassword()) return 'Le due password non coincidono.';
    return '';
  });

  private embeddedCheckout: EmbeddedCheckout | null = null;
  private stripeLoader: Promise<StripeClient> | null = null;
  private privacyPoll: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(() => {
      const workspaceId = this.workspaces.current()?.workspace.id;
      if (workspaceId) void this.load(workspaceId);
    });
    effect(() => {
      const fragment = this.fragment();
      if (this.isSettingsSection(fragment)) this.activeSection.set(fragment);
    });
  }

  ngOnDestroy(): void {
    this.destroyEmbeddedCheckout();
    if (this.privacyPoll) clearTimeout(this.privacyPoll);
  }

  protected selectSection(section: SettingsSection): void {
    this.activeSection.set(section);
    void this.router.navigate([], { relativeTo: this.route, fragment: section, replaceUrl: true });
    document.querySelector('.settings-content-top')?.scrollIntoView({ behavior: 'smooth' });
  }

  private isSettingsSection(value: string | null): value is SettingsSection {
    return this.sections.some((section) => section.id === value);
  }

  protected async saveProfile(): Promise<void> {
    const name = this.displayName().trim();
    if (name.length < 2) {
      this.error.set('Inserisci un nome di almeno 2 caratteri.');
      return;
    }
    await this.runSave(async () => {
      const principal = await firstValueFrom(
        this.http.patch<Principal>('/api/v1/auth/me', { displayName: name }),
      );
      this.auth.principal.set(principal);
      this.ui.notify('Profilo aggiornato');
    });
  }

  protected async saveWorkspace(): Promise<void> {
    const workspaceId = this.workspaces.current()?.workspace.id;
    const name = this.workspaceName().trim();
    if (!workspaceId || name.length < 2) {
      this.error.set('Inserisci un nome workspace valido.');
      return;
    }
    await this.runSave(async () => {
      await firstValueFrom(this.http.patch(`/api/v1/workspaces/${workspaceId}`, { name }));
      await this.workspaces.load();
      this.ui.notify('Workspace aggiornato');
    });
  }

  protected async changePassword(): Promise<void> {
    if (!this.currentPassword() || this.passwordError()) {
      this.error.set(this.passwordError() || 'Inserisci la password attuale.');
      return;
    }
    await this.runSave(async () => {
      await firstValueFrom(
        this.http.patch('/api/v1/auth/password', {
          currentPassword: this.currentPassword(),
          newPassword: this.newPassword(),
        }),
      );
      this.currentPassword.set('');
      this.newPassword.set('');
      this.confirmPassword.set('');
      this.ui.notify('Password aggiornata; le altre sessioni sono state revocate');
    });
  }

  protected async revokeSession(sessionId: string): Promise<void> {
    if (sessionId === this.auth.principal()?.sessionId) return;
    const confirmed = await this.dialogs.confirm(
      'Il dispositivo perderà immediatamente l’accesso a PortfolioHub.',
      { title: 'Revoca sessione', confirmLabel: 'Revoca dispositivo' },
    );
    if (!confirmed) return;
    await this.runSave(async () => {
      await firstValueFrom(this.http.delete(`/api/v1/auth/sessions/${sessionId}`));
      this.sessions.update((items) => items.filter((item) => item.id !== sessionId));
      this.ui.notify('Sessione revocata');
    });
  }

  protected async revokeOtherSessions(): Promise<void> {
    const others = this.sessions().filter((item) => item.id !== this.auth.principal()?.sessionId);
    if (others.length === 0) return;
    const confirmed = await this.dialogs.confirm(
      `Verranno disconnessi ${others.length} dispositivi. La sessione corrente resterà attiva.`,
      { title: 'Revoca altre sessioni', confirmLabel: 'Revoca tutte' },
    );
    if (!confirmed) return;
    await this.runSave(async () => {
      await firstValueFrom(this.http.delete('/api/v1/auth/sessions'));
      const currentId = this.auth.principal()?.sessionId;
      this.sessions.update((items) => items.filter((item) => item.id === currentId));
      this.ui.notify('Tutte le altre sessioni sono state revocate');
    });
  }

  protected preference(key: keyof NotificationPreferences): boolean {
    return this.preferences()?.[key] ?? false;
  }

  protected togglePreference(key: keyof NotificationPreferences): void {
    this.preferences.update((current) =>
      current ? { ...current, [key]: !current[key] } : current,
    );
  }

  protected async savePreferences(): Promise<void> {
    const workspaceId = this.workspaces.current()?.workspace.id;
    const preferences = this.preferences();
    if (!workspaceId || !preferences) return;
    await this.runSave(async () => {
      const updated = await firstValueFrom(
        this.http.patch<NotificationPreferences>(
          `/api/v1/workspaces/${workspaceId}/notifications/preferences`,
          preferences,
        ),
      );
      this.preferences.set(updated);
      this.ui.notify('Preferenze notifiche salvate');
    });
  }

  protected async requestBackup(): Promise<void> {
    await this.runSave(async () => {
      await firstValueFrom(
        this.http.post('/api/v1/account/privacy-requests', { kind: 'portability' }),
      );
      this.privacyRequests.set(
        await firstValueFrom(this.http.get<PrivacyRequest[]>('/api/v1/account/privacy-requests')),
      );
      this.schedulePrivacyRefresh();
      this.ui.notify('Preparazione del backup totale avviata');
    });
  }

  protected downloadBackup(request: PrivacyRequest): void {
    if (request.status !== 'completed' || !request.resultKey) return;
    window.location.assign(`/api/v1/account/privacy-requests/${request.id}/download`);
  }

  protected async wipeWorkspace(): Promise<void> {
    const current = this.workspaces.current();
    if (!current) return;
    const confirmation = await this.dialogs.prompt(
      `Digita ${current.workspace.name} per svuotare il workspace senza scaricare i dati.`,
      { title: 'Svuota workspace', confirmLabel: 'Svuota definitivamente' },
    );
    if (confirmation !== current.workspace.name) return;
    await this.runSave(async () => {
      await firstValueFrom(
        this.http.post(`/api/v1/account/workspaces/${current.workspace.id}/wipe`, {}),
      );
      await this.workspaces.load();
      this.ui.notify('Workspace svuotato');
    });
  }

  protected restartTutorial(): void {
    this.ui.restartOnboarding();
    this.ui.notify('Tutorial riavviato');
  }

  protected async scheduleDeletion(): Promise<void> {
    if (this.deletionPassword().length < 12) {
      this.error.set('Inserisci la password per confermare la cancellazione.');
      return;
    }
    const confirmed = await this.dialogs.confirm(
      'L’account e tutti i workspace di cui sei Owner saranno eliminati dopo 30 giorni.',
      { title: 'Programma cancellazione account', confirmLabel: 'Programma cancellazione' },
    );
    if (!confirmed) return;
    await this.runSave(async () => {
      this.deletion.set(
        await firstValueFrom(
          this.http.post<DeletionRequest>('/api/v1/account/deletion', {
            password: this.deletionPassword(),
          }),
        ),
      );
      this.deletionPassword.set('');
      this.ui.notify('Cancellazione programmata tra 30 giorni');
    });
  }

  protected async cancelDeletion(): Promise<void> {
    if (this.deletionPassword().length < 12) {
      this.error.set('Inserisci la password per annullare la cancellazione.');
      return;
    }
    await this.runSave(async () => {
      await firstValueFrom(
        this.http.delete('/api/v1/account/deletion', {
          body: { password: this.deletionPassword() },
        }),
      );
      this.deletion.set(null);
      this.deletionPassword.set('');
      await this.workspaces.load();
      this.ui.notify('Cancellazione account annullata');
    });
  }

  protected planName(plan: BillingPlan['id']): string {
    return plan === 'unlimited' ? 'Unlimited' : plan === 'pro' ? 'Pro' : 'Free';
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

  protected currentPlanPrice(plan: BillingPlan): string {
    const interval = this.billing()?.subscription?.billingInterval;
    const amount = interval === 'annual' ? plan.annual : plan.monthly;
    return amount.toLocaleString('it-IT', {
      minimumFractionDigits: amount % 1 ? 2 : 0,
      maximumFractionDigits: 2,
    });
  }

  protected async choosePlan(plan: 'pro' | 'unlimited'): Promise<void> {
    const workspaceId = this.workspaces.current()?.workspace.id;
    const billing = this.billing();
    const catalog = this.catalog();
    if (!workspaceId || !billing || !catalog) return;
    if (billing.subscription && ['active', 'trialing'].includes(billing.subscription.status)) {
      this.openCustomerPortal();
      return;
    }
    if (catalog.provider !== 'stripe' || !catalog.publishableKey) {
      this.error.set(
        'Stripe non è configurato: completa provider, chiavi e Price ID nel file .env.',
      );
      return;
    }
    this.saving.set(true);
    this.checkoutPlan.set(plan);
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
          this.ui.notify('Pagamento ricevuto; attendiamo la conferma Stripe');
          setTimeout(() => void this.load(workspaceId), 1200);
        },
      });
      this.embeddedCheckout.mount('#settings-stripe-checkout');
    } catch (error) {
      this.checkoutOpen.set(false);
      this.checkoutPlan.set(null);
      this.error.set(this.message(error));
    } finally {
      this.saving.set(false);
    }
  }

  protected openCustomerPortal(): void {
    window.open(BILLING_PORTAL_URL, '_blank', 'noopener,noreferrer');
  }

  protected closeCheckout(): void {
    this.destroyEmbeddedCheckout();
    this.checkoutOpen.set(false);
    this.checkoutPlan.set(null);
  }

  private async load(workspaceId: string): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const [billing, catalog, preferences, privacy, deletion, sessions] = await Promise.all([
        firstValueFrom(this.http.get<Billing>(`/api/v1/billing/workspaces/${workspaceId}`)),
        firstValueFrom(this.http.get<BillingCatalog>('/api/v1/billing/catalog')),
        firstValueFrom(
          this.http.get<NotificationPreferences>(
            `/api/v1/workspaces/${workspaceId}/notifications/preferences`,
          ),
        ),
        firstValueFrom(this.http.get<PrivacyRequest[]>('/api/v1/account/privacy-requests')),
        firstValueFrom(this.http.get<DeletionRequest | null>('/api/v1/account/deletion')),
        firstValueFrom(this.http.get<AccountSession[]>('/api/v1/auth/sessions')),
      ]);
      this.billing.set(billing);
      this.catalog.set(catalog);
      this.preferences.set(preferences);
      this.privacyRequests.set(privacy);
      if (privacy.some((request) => ['queued', 'processing'].includes(request.status)))
        this.schedulePrivacyRefresh();
      this.deletion.set(deletion);
      this.sessions.set(sessions);
      this.billingAnnual.set(billing.subscription?.billingInterval === 'annual');
      this.displayName.set(this.auth.principal()?.displayName ?? '');
      this.workspaceName.set(this.workspaces.current()?.workspace.name ?? '');
    } catch (error) {
      this.error.set(this.message(error));
    } finally {
      this.loading.set(false);
    }
  }

  private async runSave(action: () => Promise<void>): Promise<void> {
    this.saving.set(true);
    this.error.set('');
    try {
      await action();
    } catch (error) {
      this.error.set(this.message(error));
    } finally {
      this.saving.set(false);
    }
  }

  private schedulePrivacyRefresh(): void {
    if (this.privacyPoll) clearTimeout(this.privacyPoll);
    this.privacyPoll = setTimeout(async () => {
      const privacy = await firstValueFrom(
        this.http.get<PrivacyRequest[]>('/api/v1/account/privacy-requests'),
      ).catch(() => this.privacyRequests());
      this.privacyRequests.set(privacy);
      if (privacy.some((request) => ['queued', 'processing'].includes(request.status)))
        this.schedulePrivacyRefresh();
    }, 4_000);
  }

  private loadStripe(publishableKey: string): Promise<StripeClient> {
    if (this.stripeLoader) return this.stripeLoader;
    this.stripeLoader = new Promise<StripeClient>((resolve, reject) => {
      const initialize = () =>
        window.Stripe
          ? resolve(window.Stripe(publishableKey))
          : reject(new Error('Stripe.js non disponibile.'));
      if (window.Stripe) {
        initialize();
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://js.stripe.com/clover/stripe.js';
      script.async = true;
      script.onload = initialize;
      script.onerror = () => reject(new Error('Impossibile caricare Stripe.js.'));
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
}
