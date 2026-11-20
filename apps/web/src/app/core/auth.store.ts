import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

export type SessionCheck = 'authenticated' | 'unauthenticated' | 'unavailable';

/** Errori che non provano che la sessione sia scaduta: rete, timeout, 5xx, rate limit. */
function isTransient(error: unknown): boolean {
  const status = (error as { status?: number } | null)?.status;
  return status === undefined || status === 0 || status === 408 || status === 429 || status >= 500;
}

export interface Principal {
  userId: string;
  sessionId: string;
  email: string;
  displayName: string;
}

@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  readonly principal = signal<Principal | null>(null);
  readonly loading = signal(false);

  /** Pause tra i tentativi di `/auth/me` quando il server non risponde (modificabile nei test). */
  retryDelaysMs = [400, 1200];
  private revalidation: Promise<void> | null = null;

  /**
   * Verifica la sessione con `/auth/me`. Solo un 401/403 la dichiara scaduta;
   * un errore transitorio non cancella l'utente e viene ritentato.
   */
  async checkSession(): Promise<SessionCheck> {
    if (this.principal()) return 'authenticated';
    for (let attempt = 0; ; attempt++) {
      try {
        this.principal.set(await firstValueFrom(this.http.get<Principal>('/api/v1/auth/me')));
        return 'authenticated';
      } catch (error) {
        if (!isTransient(error)) {
          this.principal.set(null);
          return 'unauthenticated';
        }
        const delay = this.retryDelaysMs[attempt];
        if (delay === undefined) return 'unavailable';
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  async restore(): Promise<boolean> {
    return (await this.checkSession()) === 'authenticated';
  }

  /**
   * Chiamato dall'interceptor quando una richiesta qualunque risponde 401.
   * Non fa logout da solo: chiede a `/auth/me` e chiude la sessione locale
   * soltanto se anche lì la risposta è 401 (sessione davvero scaduta o revocata).
   */
  handleUnauthorized(): Promise<void> {
    if (!this.principal()) return Promise.resolve();
    this.revalidation ??= this.revalidate().finally(() => {
      this.revalidation = null;
    });
    return this.revalidation;
  }

  private async revalidate(): Promise<void> {
    try {
      this.principal.set(await firstValueFrom(this.http.get<Principal>('/api/v1/auth/me')));
    } catch (error) {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401) return;
      this.principal.set(null);
      await this.router.navigate(['/accedi'], {
        queryParams: { returnUrl: this.router.url, sessione: 'scaduta' },
      });
    }
  }

  async login(email: string, password: string, revokeSessionId?: string): Promise<void> {
    this.loading.set(true);
    try {
      this.principal.set(
        await firstValueFrom(
          this.http.post<Principal>('/api/v1/auth/login', {
            email,
            password,
            revokeSessionId,
          }),
        ),
      );
    } finally {
      this.loading.set(false);
    }
  }

  async signUp(input: {
    email: string;
    displayName: string;
    password: string;
    workspaceName: string;
    workspaceType: 'freelance' | 'studio';
  }): Promise<void> {
    this.loading.set(true);
    try {
      await firstValueFrom(this.http.post('/api/v1/auth/signup', input));
    } finally {
      this.loading.set(false);
    }
  }

  async verify(token: string, revokeSessionId?: string): Promise<void> {
    this.loading.set(true);
    try {
      this.principal.set(
        await firstValueFrom(
          this.http.post<Principal>('/api/v1/auth/verify-email', { token, revokeSessionId }),
        ),
      );
    } finally {
      this.loading.set(false);
    }
  }

  async consumeMagicLink(token: string, revokeSessionId?: string): Promise<void> {
    this.loading.set(true);
    try {
      this.principal.set(
        await firstValueFrom(
          this.http.post<Principal>('/api/v1/auth/magic-link/consume', {
            token,
            revokeSessionId,
          }),
        ),
      );
    } finally {
      this.loading.set(false);
    }
  }

  async resetPassword(token: string, password: string): Promise<void> {
    this.loading.set(true);
    try {
      await firstValueFrom(
        this.http.post<void>('/api/v1/auth/password-reset/complete', { token, password }),
      );
    } finally {
      this.loading.set(false);
    }
  }

  async logout(): Promise<void> {
    await firstValueFrom(this.http.post('/api/v1/auth/logout', {}));
    this.principal.set(null);
  }
}
