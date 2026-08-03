import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  OnDestroy,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { UiStore } from '../core/ui-store';
import { WorkspaceStore } from '../core/workspace.store';
import { AppendToBody } from '../ui/append-to-body';
import { CustomSelect, type SelectOption } from '../ui/custom-select';

interface SupportTicket {
  id: string;
  subject: string;
  category: 'technical' | 'billing' | 'account' | 'security' | 'other';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'waiting_user' | 'resolved' | 'closed';
  description: string;
  createdAt: string;
  updatedAt: string;
}
interface TicketMessage {
  id: string;
  authorType: 'user' | 'staff';
  body: string;
  createdAt: string;
}

@Component({
  selector: 'ph-support-tickets',
  imports: [FormsModule, DatePipe, AppendToBody, CustomSelect],
  templateUrl: './support-tickets.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SupportTicketsPage implements OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly workspaces = inject(WorkspaceStore);
  private readonly ui = inject(UiStore);
  protected readonly tickets = signal<SupportTicket[]>([]);
  protected readonly loading = signal(true);
  protected readonly sending = signal(false);
  protected readonly error = signal('');
  protected readonly selectedTicket = signal<SupportTicket | null>(null);
  protected readonly messages = signal<TicketMessage[]>([]);
  protected readonly conversationLoading = signal(false);
  protected readonly replySending = signal(false);
  protected readonly createTicketOpen = signal(false);
  protected replyBody = '';
  protected subject = '';
  protected description = '';
  protected category: SupportTicket['category'] = 'technical';
  protected priority: SupportTicket['priority'] = 'normal';
  protected readonly categoryOptions: SelectOption[] = [
    { value: 'technical', label: 'Problema tecnico' },
    { value: 'billing', label: 'Piano e pagamenti' },
    { value: 'account', label: 'Account e accesso' },
    { value: 'security', label: 'Sicurezza' },
    { value: 'other', label: 'Altro' },
  ];
  protected readonly priorityOptions: SelectOption[] = [
    { value: 'low', label: 'Bassa' },
    { value: 'normal', label: 'Normale' },
    { value: 'high', label: 'Alta' },
    { value: 'urgent', label: 'Urgente' },
  ];
  private loadedWorkspaceId = '';
  private eventSource: EventSource | null = null;

  constructor() {
    effect(() => {
      const workspaceId = this.workspaces.current()?.workspace.id;
      if (workspaceId && workspaceId !== this.loadedWorkspaceId) {
        this.loadedWorkspaceId = workspaceId;
        void this.load(workspaceId);
      }
    });
  }

  protected async submit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const workspaceId = this.workspaces.current()?.workspace.id;
    if (!workspaceId || this.subject.trim().length < 5 || this.description.trim().length < 20)
      return;
    this.sending.set(true);
    this.error.set('');
    try {
      const ticket = await firstValueFrom(
        this.http.post<SupportTicket>(`/api/v1/workspaces/${workspaceId}/tickets`, {
          subject: this.subject,
          description: this.description,
          category: this.category,
          priority: this.priority,
        }),
      );
      this.tickets.update((items) => [ticket, ...items]);
      this.subject = '';
      this.description = '';
      this.category = 'technical';
      this.priority = 'normal';
      this.createTicketOpen.set(false);
      this.ui.notify('Ticket aperto · il supporto lo ha ricevuto');
      await this.openTicket(ticket);
    } catch (error) {
      this.error.set(this.message(error));
    } finally {
      this.sending.set(false);
    }
  }

  ngOnDestroy(): void {
    this.eventSource?.close();
  }

  protected async openTicket(ticket: SupportTicket): Promise<void> {
    const workspaceId = this.workspaces.current()?.workspace.id;
    if (!workspaceId) return;
    this.selectedTicket.set(ticket);
    this.messages.set([]);
    this.conversationLoading.set(true);
    this.eventSource?.close();
    try {
      this.messages.set(
        await firstValueFrom(
          this.http.get<TicketMessage[]>(
            `/api/v1/workspaces/${workspaceId}/tickets/${ticket.id}/messages`,
          ),
        ),
      );
      this.connectEvents(workspaceId, ticket.id);
    } catch (error) {
      this.error.set(this.message(error));
    } finally {
      this.conversationLoading.set(false);
    }
  }

  protected closeTicket(): void {
    this.eventSource?.close();
    this.eventSource = null;
    this.selectedTicket.set(null);
    this.messages.set([]);
    this.replyBody = '';
  }

  protected openCreateTicket(): void {
    this.error.set('');
    this.createTicketOpen.set(true);
  }

  protected closeCreateTicket(): void {
    if (this.sending()) return;
    this.createTicketOpen.set(false);
  }

  protected categoryLabel(category: SupportTicket['category']): string {
    return this.categoryOptions.find((option) => option.value === category)?.label ?? category;
  }

  protected priorityLabel(priority: SupportTicket['priority']): string {
    return this.priorityOptions.find((option) => option.value === priority)?.label ?? priority;
  }

  protected async sendReply(event: Event): Promise<void> {
    event.preventDefault();
    const workspaceId = this.workspaces.current()?.workspace.id;
    const ticket = this.selectedTicket();
    const body = this.replyBody.trim();
    if (!workspaceId || !ticket || !body || ticket.status === 'closed') return;
    this.replySending.set(true);
    try {
      const message = await firstValueFrom(
        this.http.post<TicketMessage>(
          `/api/v1/workspaces/${workspaceId}/tickets/${ticket.id}/messages`,
          { body },
        ),
      );
      this.messages.update((items) => [...items, message]);
      this.replyBody = '';
      this.tickets.update((items) =>
        items.map((item) =>
          item.id === ticket.id ? { ...item, status: 'open', updatedAt: message.createdAt } : item,
        ),
      );
    } catch (error) {
      this.error.set(this.message(error));
    } finally {
      this.replySending.set(false);
    }
  }

  private connectEvents(workspaceId: string, ticketId: string): void {
    const source = new EventSource(`/api/v1/workspaces/${workspaceId}/tickets/${ticketId}/events`, {
      withCredentials: true,
    });
    source.onmessage = (event) => {
      const payload = JSON.parse(event.data) as { heartbeat?: boolean; messages?: TicketMessage[] };
      if (payload.messages) this.messages.set(payload.messages);
    };
    source.onerror = () => {
      if (this.selectedTicket()?.id !== ticketId) source.close();
    };
    this.eventSource = source;
  }

  protected statusLabel(status: SupportTicket['status']): string {
    return {
      open: 'Aperto',
      in_progress: 'In lavorazione',
      waiting_user: 'In attesa di una risposta',
      resolved: 'Risolto',
      closed: 'Chiuso',
    }[status];
  }

  private async load(workspaceId: string): Promise<void> {
    this.loading.set(true);
    try {
      this.tickets.set(
        await firstValueFrom(
          this.http.get<SupportTicket[]>(`/api/v1/workspaces/${workspaceId}/tickets`),
        ),
      );
    } catch (error) {
      this.error.set(this.message(error));
    } finally {
      this.loading.set(false);
    }
  }

  private message(error: unknown): string {
    const candidate = error as { error?: { message?: string | string[] } };
    const message = candidate.error?.message;
    return Array.isArray(message) ? message.join(', ') : (message ?? 'Operazione non riuscita.');
  }
}
