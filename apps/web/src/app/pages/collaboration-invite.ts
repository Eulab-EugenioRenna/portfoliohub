import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, type OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../core/auth.store';

interface InvitePreview {
  workspaceName: string;
  role: string;
  emailHint: string;
  expiresAt: string;
}

@Component({
  selector: 'ph-collaboration-invite',
  imports: [DatePipe, RouterLink],
  templateUrl: './collaboration-invite.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CollaborationInvitePage implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthStore);
  private readonly token = this.route.snapshot.paramMap.get('token') ?? '';

  protected readonly invite = signal<InvitePreview | null>(null);
  protected readonly loading = signal(true);
  protected readonly accepting = signal(false);
  protected readonly error = signal('');

  ngOnInit(): void {
    void this.load();
  }

  protected async accept(): Promise<void> {
    if (!this.token) return;
    this.accepting.set(true);
    this.error.set('');
    try {
      if (!(await this.auth.restore())) {
        await this.router.navigate(['/accedi'], {
          queryParams: { returnUrl: `/collab/${this.token}` },
        });
        return;
      }
      await firstValueFrom(
        this.http.post(`/api/v1/public/collaboration-invites/${this.token}/accept`, {}),
      );
      await this.router.navigateByUrl('/panoramica');
    } catch (error) {
      const response = error as { error?: { message?: string } };
      this.error.set(response.error?.message ?? 'Non è stato possibile accettare l’invito.');
    } finally {
      this.accepting.set(false);
    }
  }

  private async load(): Promise<void> {
    if (!this.token) {
      this.error.set('Invito non valido.');
      this.loading.set(false);
      return;
    }
    try {
      this.invite.set(
        await firstValueFrom(
          this.http.get<InvitePreview>(`/api/v1/public/collaboration-invites/${this.token}`),
        ),
      );
    } catch (error) {
      const response = error as { error?: { message?: string } };
      this.error.set(response.error?.message ?? 'L’invito non è disponibile o è scaduto.');
    } finally {
      this.loading.set(false);
    }
  }
}
