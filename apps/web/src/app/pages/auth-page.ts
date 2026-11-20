import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  type OnInit,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthStore } from '../core/auth.store';
import {
  describeLastUse,
  describeUserAgent,
  readSessionLimit,
  type SessionLimitInfo,
  sessionLimitMessage,
} from '../core/session-info';

type AuthMode = 'login' | 'signup' | 'verify' | 'reset';
/** Come è stato richiesto l'accesso bloccato dal limite: serve per ripeterlo con la sessione scelta. */
type PendingAccess = 'login' | 'magic' | 'verify';

@Component({
  selector: 'ph-auth-page',
  imports: [FormsModule, RouterLink],
  templateUrl: './auth-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthStore);
  protected readonly mode = computed(() => this.route.snapshot.data['mode'] as AuthMode);
  protected readonly error = signal<string | null>(null);
  protected readonly pendingVerification = signal(false);
  protected readonly sessionLimit = signal<SessionLimitInfo | null>(null);
  protected readonly notice = signal<string | null>(null);
  private pendingAccess: PendingAccess = 'login';
  protected readonly revokingSession = signal<string | null>(null);
  protected email = '';
  protected password = '';
  protected displayName = '';
  protected workspaceName = '';
  protected workspaceType: 'freelance' | 'studio' = 'freelance';
  protected token = this.route.snapshot.queryParamMap.get('token') ?? '';
  private magicToken = '';
  protected readonly describeUserAgent = describeUserAgent;
  protected readonly describeLastUse = describeLastUse;

  ngOnInit(): void {
    const reason = this.route.snapshot.queryParamMap.get('sessione');
    if (reason === 'scaduta')
      this.notice.set('La sessione è scaduta. Accedi di nuovo per continuare.');
    const magicToken = this.route.snapshot.queryParamMap.get('magic');
    if (this.mode() === 'login' && magicToken) void this.consumeMagicLink(magicToken);
    if (this.mode() === 'verify' && this.token) void this.submit();
  }

  protected async submit(): Promise<void> {
    this.error.set(null);
    this.sessionLimit.set(null);
    try {
      if (this.mode() === 'login') {
        this.pendingAccess = 'login';
        await this.auth.login(this.email, this.password);
        await this.goAfterLogin();
      } else if (this.mode() === 'signup') {
        await this.auth.signUp({
          email: this.email,
          password: this.password,
          displayName: this.displayName,
          workspaceName: this.workspaceName,
          workspaceType: this.workspaceType,
        });
        this.pendingVerification.set(true);
      } else if (this.mode() === 'verify') {
        this.pendingAccess = 'verify';
        await this.auth.verify(this.token);
        await this.router.navigateByUrl('/panoramica');
      } else {
        await this.auth.resetPassword(this.token, this.password);
        await this.router.navigateByUrl('/accedi');
      }
    } catch (error) {
      this.showError(error, 'Operazione non riuscita');
    }
  }

  private async consumeMagicLink(token: string): Promise<void> {
    this.error.set(null);
    this.sessionLimit.set(null);
    this.pendingAccess = 'magic';
    this.magicToken = token;
    try {
      await this.auth.consumeMagicLink(token);
      await this.goAfterLogin();
    } catch (error) {
      this.showError(error, 'Il link di accesso non è valido o è scaduto.');
    }
  }

  /** Ripete l'accesso che ha trovato il limite, chiudendo la sessione scelta. */
  protected async revokeAndLogin(sessionId: string): Promise<void> {
    this.error.set(null);
    this.revokingSession.set(sessionId);
    try {
      if (this.pendingAccess === 'magic') {
        await this.auth.consumeMagicLink(this.magicToken, sessionId);
        await this.goAfterLogin();
      } else if (this.pendingAccess === 'verify') {
        await this.auth.verify(this.token, sessionId);
        await this.router.navigateByUrl('/panoramica');
      } else {
        await this.auth.login(this.email, this.password, sessionId);
        await this.goAfterLogin();
      }
    } catch (error) {
      this.showError(error, 'Impossibile chiudere la sessione');
    } finally {
      this.revokingSession.set(null);
    }
  }

  private goAfterLogin(): Promise<boolean> {
    return this.router.navigateByUrl(
      this.route.snapshot.queryParamMap.get('returnUrl') ?? '/panoramica',
    );
  }

  private showError(error: unknown, fallback: string): void {
    const limit = readSessionLimit(error);
    if (limit) {
      // Messaggio chiaro + elenco delle sessioni: mai un errore muto.
      this.sessionLimit.set(limit);
      this.error.set(sessionLimitMessage(limit.limit));
      return;
    }
    // Errore diverso dal limite (es. retry fallito per rete/5xx): l'elenco e l'azione
    // pendente restano, così l'utente può riprovare senza ripartire dal link.
    const message = (error as { error?: { message?: string | string[] } } | null)?.error?.message;
    this.error.set(Array.isArray(message) ? message.join(' · ') : (message ?? fallback));
  }
}
