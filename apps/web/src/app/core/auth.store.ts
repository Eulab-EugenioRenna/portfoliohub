import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export interface Principal {
  userId: string;
  sessionId: string;
  email: string;
  displayName: string;
}

@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly http = inject(HttpClient);
  readonly principal = signal<Principal | null>(null);
  readonly loading = signal(false);

  async restore(): Promise<boolean> {
    if (this.principal()) return true;
    try {
      this.principal.set(await firstValueFrom(this.http.get<Principal>('/api/v1/auth/me')));
      return true;
    } catch {
      this.principal.set(null);
      return false;
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

  async verify(token: string): Promise<void> {
    this.principal.set(
      await firstValueFrom(this.http.post<Principal>('/api/v1/auth/verify-email', { token })),
    );
  }

  async consumeMagicLink(token: string): Promise<void> {
    this.loading.set(true);
    try {
      this.principal.set(
        await firstValueFrom(
          this.http.post<Principal>('/api/v1/auth/magic-link/consume', { token }),
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
