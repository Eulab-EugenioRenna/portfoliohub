import { HttpClient } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  HostListener,
  inject,
  OnDestroy,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../core/auth.store';
import { UiStore } from '../core/ui-store';
import { WorkspaceStore } from '../core/workspace.store';
import { AppendToBody } from '../ui/append-to-body';
import { CustomSelect, type SelectOption } from '../ui/custom-select';
import { PhNoticeBanner } from '../ui/design-system';
import { DialogHost } from '../ui/dialog-host';

interface NavItem {
  label: string;
  route: string;
  icon: string;
  badge?: number;
}
interface NotificationItem {
  id: string;
  title: string;
  body: string;
  actionUrl: string | null;
  readAt: string | null;
  createdAt: string;
  kind?: string;
}
interface NotificationPreferences {
  inAppBanner: boolean;
  ticketUpdates: boolean;
  deliveryActivity: boolean;
  workspaceActivity: boolean;
}
interface SearchResult {
  id: string;
  type: 'project' | 'client' | 'file' | 'folder';
  title: string;
  subtitle: string;
  actionUrl: string;
}

@Component({
  selector: 'ph-app-shell',
  imports: [
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    FormsModule,
    AppendToBody,
    CustomSelect,
    DialogHost,
    PhNoticeBanner,
  ],
  templateUrl: './app-shell.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppShell implements OnDestroy {
  protected readonly ui = inject(UiStore);
  protected readonly workspaces = inject(WorkspaceStore);
  protected readonly auth = inject(AuthStore);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  protected projectName = '';
  protected readonly searchQuery = signal('');
  protected readonly searchResults = signal<SearchResult[]>([]);
  protected readonly searchOpen = signal(false);
  protected readonly searching = signal(false);
  protected readonly notifications = signal<NotificationItem[]>([]);
  protected readonly notificationPanelOpen = signal(false);
  protected readonly profilePanelOpen = signal(false);
  protected readonly workspacePanelOpen = signal(false);
  protected readonly workspaceCreateOpen = signal(false);
  protected readonly workspaceCreating = signal(false);
  protected readonly newWorkspaceName = signal('');
  protected readonly newWorkspaceType = signal<'freelance' | 'studio'>('studio');
  protected readonly notificationsLoading = signal(false);
  protected readonly unreadNotifications = signal(0);
  protected readonly notificationFilter = signal<'unread' | 'all'>('unread');
  protected readonly visibleNotifications = computed(() => {
    const items = this.notifications();
    return this.notificationFilter() === 'unread' ? items.filter((item) => !item.readAt) : items;
  });
  protected readonly storagePercentage = computed(() => {
    const usage = this.workspaces.storageUsage();
    if (!usage?.storageLimitBytes) return null;
    const used = BigInt(usage.storageBytes);
    const limit = BigInt(usage.storageLimitBytes);
    if (limit <= 0n) return 0;
    return Math.min(100, Number((used * 10_000n) / limit) / 100);
  });
  protected readonly storageUsedLabel = computed(() =>
    this.formatStorage(this.workspaces.storageUsage()?.storageBytes ?? '0'),
  );
  protected readonly storageLimitLabel = computed(() => {
    const limit = this.workspaces.storageUsage()?.storageLimitBytes;
    return limit ? this.formatStorage(limit) : 'Illimitato';
  });
  protected readonly notificationPreferences = signal<NotificationPreferences | null>(null);
  protected readonly projectDialogOpen = signal(false);
  protected readonly workspaceNav: NavItem[] = [
    { label: 'Panoramica', route: '/panoramica', icon: 'PA' },
    { label: 'Progetti', route: '/progetti', icon: 'PR', badge: 3 },
    { label: 'Clienti', route: '/clienti', icon: 'CL' },
    { label: 'Consegne', route: '/consegne', icon: 'CO', badge: 2 },
    { label: 'Portfolio', route: '/portfolio', icon: 'PF' },
  ];
  protected readonly managementNav: NavItem[] = [
    { label: 'Team', route: '/team', icon: 'TM' },
    { label: 'Apri ticket', route: '/ticket', icon: 'TK' },
    { label: 'Impostazioni', route: '/impostazioni', icon: 'IM' },
  ];
  protected readonly workspaceTypeOptions: SelectOption[] = [
    { value: 'studio', label: 'Studio o team' },
    { value: 'freelance', label: 'Freelance' },
  ];
  private readonly knownNotificationIds = new Set<string>();
  private notificationWorkspaceId: string | null = null;
  private notificationPoll: ReturnType<typeof setInterval> | null = null;
  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private searchRequest = 0;

  constructor() {
    void this.workspaces.load();
    effect(() => {
      const workspaceId = this.workspaces.current()?.workspace.id;
      if (!workspaceId || workspaceId === this.notificationWorkspaceId) return;
      this.notificationWorkspaceId = workspaceId;
      this.knownNotificationIds.clear();
      void this.refreshNotifications(false);
      void this.loadNotificationPreferences();
      this.startNotificationPolling();
    });
  }

  ngOnDestroy(): void {
    if (this.notificationPoll) clearInterval(this.notificationPoll);
    if (this.searchTimer) clearTimeout(this.searchTimer);
  }

  private formatStorage(bytes: string): string {
    const value = BigInt(bytes);
    if (value === 0n) return '0 GB';
    const gigabyte = 1_000_000_000n;
    return `${(value + gigabyte - 1n) / gigabyte} GB`;
  }

  protected openProject(): void {
    this.projectDialogOpen.set(true);
  }


  protected toggleWorkspacePanel(): void {
    this.workspacePanelOpen.update((open) => !open);
    this.notificationPanelOpen.set(false);
    this.profilePanelOpen.set(false);
    this.searchOpen.set(false);
  }

  protected selectWorkspace(id: string): void {
    this.workspaces.select(id);
    this.workspacePanelOpen.set(false);
  }

  protected openWorkspaceCreation(): void {
    if (!this.workspaces.capabilities().canCreate) return;
    this.workspacePanelOpen.set(false);
    this.workspaceCreateOpen.set(true);
  }

  protected async openWorkspacePlans(): Promise<void> {
    this.workspacePanelOpen.set(false);
    await this.router.navigate(['/impostazioni'], { fragment: 'plans' });
  }

  protected async createWorkspace(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const name = this.newWorkspaceName().trim();
    if (name.length < 2 || this.workspaceCreating()) return;
    this.workspaceCreating.set(true);
    try {
      await this.workspaces.create({ name, type: this.newWorkspaceType() });
      this.newWorkspaceName.set('');
      this.newWorkspaceType.set('studio');
      this.workspaceCreateOpen.set(false);
      this.ui.notify('Workspace creato');
    } catch (error) {
      const value = error as { error?: { message?: string } };
      this.ui.notify(value.error?.message ?? 'Creazione workspace non riuscita');
    } finally {
      this.workspaceCreating.set(false);
    }
  }

  protected closeDialogs(): void {
    this.projectDialogOpen.set(false);
    this.workspaceCreateOpen.set(false);
  }

  protected async submitSearch(event: Event): Promise<void> {
    event.preventDefault();
    if (this.searchTimer) clearTimeout(this.searchTimer);
    await this.runSearch();
  }

  protected queueSearch(value: string): void {
    this.searchQuery.set(value);
    if (this.searchTimer) clearTimeout(this.searchTimer);
    if (value.trim().length < 2) {
      this.searchRequest += 1;
      this.searchResults.set([]);
      this.searchOpen.set(false);
      this.searching.set(false);
      return;
    }
    this.searchOpen.set(true);
    this.searching.set(true);
    this.notificationPanelOpen.set(false);
    this.profilePanelOpen.set(false);
    this.workspacePanelOpen.set(false);
    this.searchTimer = setTimeout(() => void this.runSearch(), 250);
  }

  private async runSearch(): Promise<void> {
    const workspaceId = this.workspaces.current()?.workspace.id;
    const query = this.searchQuery().trim();
    if (!workspaceId || query.length < 2) {
      this.searchResults.set([]);
      this.searchOpen.set(false);
      return;
    }
    const request = ++this.searchRequest;
    this.searching.set(true);
    try {
      const results = await firstValueFrom(
        this.http.get<SearchResult[]>(`/api/v1/workspaces/${workspaceId}/search`, {
          params: { q: query },
        }),
      );
      if (request !== this.searchRequest) return;
      this.searchResults.set(results);
      this.searchOpen.set(true);
      this.notificationPanelOpen.set(false);
    } finally {
      if (request === this.searchRequest) this.searching.set(false);
    }
  }

  protected async toggleNotifications(): Promise<void> {
    const open = !this.notificationPanelOpen();
    this.notificationPanelOpen.set(open);
    this.profilePanelOpen.set(false);
    this.workspacePanelOpen.set(false);
    this.searchOpen.set(false);
    if (!open) return;
    await this.refreshNotifications(false, true);
  }

  protected async markAllNotificationsRead(): Promise<void> {
    const workspaceId = this.workspaces.current()?.workspace.id;
    if (!workspaceId || this.unreadNotifications() === 0) return;
    await firstValueFrom(
      this.http.patch(`/api/v1/workspaces/${workspaceId}/notifications/read-all`, {}),
    );
    const readAt = new Date().toISOString();
    this.notifications.update((items) => items.map((item) => ({ ...item, readAt })));
    this.unreadNotifications.set(0);
  }

  protected async openNotificationPreferences(): Promise<void> {
    this.notificationPanelOpen.set(false);
    await this.router.navigate(['/impostazioni'], { fragment: 'notifications' });
  }

  protected async openNoticeAction(): Promise<void> {
    const actionUrl = this.ui.notice()?.actionUrl;
    this.ui.dismissNotice();
    if (actionUrl) await this.router.navigateByUrl(actionUrl);
  }

  protected notificationTime(value: string): string {
    const date = new Date(value);
    const elapsed = Date.now() - date.getTime();
    if (elapsed < 60_000) return 'Adesso';
    if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)} min fa`;
    if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)} h fa`;
    return new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short' }).format(date);
  }

  protected async openNotification(item: NotificationItem): Promise<void> {
    const workspaceId = this.workspaces.current()?.workspace.id;
    if (workspaceId && !item.readAt) {
      await firstValueFrom(
        this.http.patch(`/api/v1/workspaces/${workspaceId}/notifications/${item.id}/read`, {}),
      );
      this.notifications.update((items) =>
        items.map((current) =>
          current.id === item.id ? { ...current, readAt: new Date().toISOString() } : current,
        ),
      );
      this.unreadNotifications.update((count) => Math.max(0, count - 1));
    }
    this.notificationPanelOpen.set(false);
    if (item.actionUrl) await this.router.navigateByUrl(item.actionUrl);
  }

  protected async openSearchResult(result: SearchResult): Promise<void> {
    this.searchOpen.set(false);
    await this.router.navigateByUrl(result.actionUrl);
  }

  protected toggleProfile(): void {
    this.profilePanelOpen.update((open) => !open);
    this.notificationPanelOpen.set(false);
    this.workspacePanelOpen.set(false);
    this.searchOpen.set(false);
  }

  protected async openSettings(): Promise<void> {
    this.profilePanelOpen.set(false);
    await this.router.navigateByUrl('/impostazioni');
  }

  protected restartOnboarding(): void {
    this.profilePanelOpen.set(false);
    this.ui.restartOnboarding();
  }

  protected async logout(): Promise<void> {
    this.profilePanelOpen.set(false);
    await this.auth.logout();
    await this.router.navigateByUrl('/accedi');
  }

  @HostListener('document:click', ['$event'])
  protected closeHeaderPanelsOnOutsideClick(event: MouseEvent): void {
    const target = event.target;
    if (
      target instanceof Element &&
      target.closest(
        '.workspace-switch-area, .search-area, .notification-area, .profile-area, [data-header-overlay][data-body-overlay]',
      )
    )
      return;
    this.searchOpen.set(false);
    this.notificationPanelOpen.set(false);
    this.profilePanelOpen.set(false);
    this.workspacePanelOpen.set(false);
  }

  @HostListener('document:keydown.escape')
  protected closeHeaderPanels(): void {
    this.searchOpen.set(false);
    this.notificationPanelOpen.set(false);
    this.profilePanelOpen.set(false);
    this.workspacePanelOpen.set(false);
  }

  @HostListener('document:keydown', ['$event'])
  protected focusGlobalSearch(event: KeyboardEvent): void {
    if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'k') return;
    event.preventDefault();
    document.querySelector<HTMLInputElement>('[data-global-search] input')?.focus();
  }

  protected async createProject(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const workspaceId = this.workspaces.current()?.workspace.id;
    if (!workspaceId || !this.projectName.trim()) return;
    await firstValueFrom(
      this.http.post(`/api/v1/workspaces/${workspaceId}/projects`, { name: this.projectName }),
    );
    this.projectName = '';
    this.closeDialogs();
    this.ui.notify('Progetto creato · aprilo per caricare i file');
  }

  private startNotificationPolling(): void {
    if (this.notificationPoll) clearInterval(this.notificationPoll);
    this.notificationPoll = setInterval(() => void this.refreshNotifications(true), 15_000);
  }

  private async loadNotificationPreferences(): Promise<void> {
    const workspaceId = this.notificationWorkspaceId;
    if (!workspaceId) return;
    try {
      const preferences = await firstValueFrom(
        this.http.get<NotificationPreferences>(
          `/api/v1/workspaces/${workspaceId}/notifications/preferences`,
        ),
      );
      if (workspaceId === this.notificationWorkspaceId)
        this.notificationPreferences.set(preferences);
    } catch {
      this.notificationPreferences.set(null);
    }
  }

  private async refreshNotifications(showBanner: boolean, showLoading = false): Promise<void> {
    const workspaceId = this.notificationWorkspaceId;
    if (!workspaceId) return;
    if (showLoading) this.notificationsLoading.set(true);
    try {
      const items = await firstValueFrom(
        this.http.get<NotificationItem[]>(`/api/v1/workspaces/${workspaceId}/notifications`),
      );
      if (workspaceId !== this.notificationWorkspaceId) return;
      const fresh = items.filter((item) => !this.knownNotificationIds.has(item.id));
      for (const item of items) this.knownNotificationIds.add(item.id);
      this.notifications.set(items);
      this.unreadNotifications.set(items.filter((item) => !item.readAt).length);
      const newest = fresh[0];
      if (showBanner && newest && this.shouldShowBanner(newest)) {
        this.ui.showNotice({
          id: newest.id,
          title: newest.title,
          message: newest.body,
          tone: newest.kind?.startsWith('support.') ? 'info' : 'success',
          actionLabel: newest.actionUrl ? 'Apri' : undefined,
          actionUrl: newest.actionUrl ?? undefined,
        });
      }
    } finally {
      if (showLoading) this.notificationsLoading.set(false);
    }
  }

  private shouldShowBanner(item: NotificationItem): boolean {
    const preferences = this.notificationPreferences();
    if (!preferences?.inAppBanner) return false;
    if (item.kind?.startsWith('support.')) return preferences.ticketUpdates;
    if (item.kind?.startsWith('delivery.')) return preferences.deliveryActivity;
    return preferences.workspaceActivity;
  }
}
