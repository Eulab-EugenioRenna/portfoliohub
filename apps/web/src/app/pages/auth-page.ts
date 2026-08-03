import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthStore } from '../core/auth.store';

type AuthMode = 'login' | 'signup' | 'verify';
interface LoginSession {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  lastSeenAt: string;
}

@Component({
  selector: 'ph-auth-page',
  imports: [FormsModule, RouterLink],
  templateUrl: './auth-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthStore);
  protected readonly mode = computed(() => this.route.snapshot.data['mode'] as AuthMode);
  protected readonly error = signal<string | null>(null);
  protected readonly pendingVerification = signal(false);
  protected readonly blockedSessions = signal<LoginSession[]>([]);
  protected readonly revokingSession = signal<string | null>(null);
  protected email = '';
  protected password = '';
  protected displayName = '';
  protected workspaceName = '';
  protected workspaceType: 'freelance' | 'studio' = 'freelance';
  protected token = this.route.snapshot.queryParamMap.get('token') ?? '';

  protected async submit(): Promise<void> {
    this.error.set(null);
    this.blockedSessions.set([]);
    try {
      if (this.mode() === 'login') {
        await this.auth.login(this.email, this.password);
        await this.router.navigateByUrl(
          this.route.snapshot.queryParamMap.get('returnUrl') ?? '/panoramica',
        );
      } else if (this.mode() === 'signup') {
        await this.auth.signUp({
          email: this.email,
          password: this.password,
          displayName: this.displayName,
          workspaceName: this.workspaceName,
          workspaceType: this.workspaceType,
        });
        this.pendingVerification.set(true);
      } else {
        await this.auth.verify(this.token);
        await this.router.navigateByUrl('/panoramica');
      }
    } catch (error) {
      const response = error as {
        error?: {
          message?: string | string[];
          code?: string;
          sessions?: LoginSession[];
        };
      };
      if (response.error?.code === 'SESSION_LIMIT_REACHED') {
        this.blockedSessions.set(response.error.sessions ?? []);
      }
      const message = response.error?.message;
      this.error.set(
        Array.isArray(message) ? message.join(' · ') : (message ?? 'Operazione non riuscita'),
      );
    }
  }

  protected async revokeAndLogin(sessionId: string): Promise<void> {
    this.error.set(null);
    this.revokingSession.set(sessionId);
    try {
      await this.auth.login(this.email, this.password, sessionId);
      await this.router.navigateByUrl(
        this.route.snapshot.queryParamMap.get('returnUrl') ?? '/panoramica',
      );
    } catch (error) {
      const response = error as { error?: { message?: string; sessions?: LoginSession[] } };
      if (response.error?.sessions) this.blockedSessions.set(response.error.sessions);
      this.error.set(response.error?.message ?? 'Impossibile revocare la sessione');
    } finally {
      this.revokingSession.set(null);
    }
  }
}
