import { Injectable, signal } from '@angular/core';

export type UiNoticeTone = 'info' | 'success' | 'warning' | 'danger';

export interface UiNotice {
  id: string;
  title: string;
  message: string;
  tone: UiNoticeTone;
  actionLabel?: string;
  actionUrl?: string;
}

@Injectable({ providedIn: 'root' })
export class UiStore {
  readonly sidebarCollapsed = signal(localStorage.getItem('ph:sidebar') === 'collapsed');
  readonly theme = signal<'dark' | 'light'>(
    localStorage.getItem('ph:theme') === 'light' ? 'light' : 'dark',
  );
  readonly notice = signal<UiNotice | null>(null);
  readonly onboardingVisible = signal(localStorage.getItem('ph:onboarding') !== 'done');
  readonly onboardingStep = signal(0);
  private noticeTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    document.documentElement.dataset['theme'] = this.theme();
  }

  toggleSidebar(): void {
    this.sidebarCollapsed.update((value) => !value);
    localStorage.setItem('ph:sidebar', this.sidebarCollapsed() ? 'collapsed' : 'expanded');
  }

  toggleTheme(): void {
    this.theme.update((value) => (value === 'dark' ? 'light' : 'dark'));
    document.documentElement.dataset['theme'] = this.theme();
    localStorage.setItem('ph:theme', this.theme());
    this.notify(this.theme() === 'dark' ? 'Modalità scura attiva' : 'Modalità chiara attiva');
  }

  notify(message: string): void {
    this.showNotice({ title: 'Operazione completata', message, tone: 'success' });
  }

  showNotice(notice: Omit<UiNotice, 'id'> & { id?: string }, duration = 6500): void {
    if (this.noticeTimer) clearTimeout(this.noticeTimer);
    this.notice.set({ ...notice, id: notice.id ?? crypto.randomUUID() });
    this.noticeTimer = setTimeout(() => this.dismissNotice(), duration);
  }

  dismissNotice(): void {
    if (this.noticeTimer) clearTimeout(this.noticeTimer);
    this.noticeTimer = null;
    this.notice.set(null);
  }

  nextOnboarding(): void {
    if (this.onboardingStep() >= 2) {
      this.completeOnboarding();
      return;
    }
    this.onboardingStep.update((step) => step + 1);
  }

  completeOnboarding(): void {
    localStorage.setItem('ph:onboarding', 'done');
    this.onboardingVisible.set(false);
    this.notify('Tour completato. Puoi riavviarlo da Aiuto.');
  }

  restartOnboarding(): void {
    this.onboardingStep.set(0);
    this.onboardingVisible.set(true);
  }
}
