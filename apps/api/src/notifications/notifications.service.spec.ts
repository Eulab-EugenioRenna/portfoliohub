import { NotificationsService } from './notifications.service';

describe('NotificationsService ticket channels', () => {
  const repository = () => ({
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => value),
    findOneBy: jest.fn(async () => null),
    findBy: jest.fn(async () => []),
    find: jest.fn(async () => []),
    update: jest.fn(async () => ({ affected: 1 })),
  });

  it('creates a staff notification and queues a transactional email', async () => {
    const notifications = repository();
    const preferences = repository();
    const deliveries = repository();
    const memberships = repository();
    const users = repository();
    const staffUsers = repository();
    const staffNotifications = repository();
    const queue = { add: jest.fn(async () => undefined) };
    staffUsers.findBy.mockResolvedValue([
      { id: 'staff-1', email: 'support@example.test', role: 'support', status: 'active' },
    ]);
    const service = new NotificationsService(
      notifications as never,
      preferences as never,
      deliveries as never,
      memberships as never,
      users as never,
      staffUsers as never,
      staffNotifications as never,
      queue as never,
      { supportEmail: 'eulabconsult@gmail.com' } as never,
    );

    await service.notifySupportStaff({
      ticketId: 'ticket-1',
      workspaceId: 'workspace-1',
      subject: 'Upload bloccato',
      body: 'Il caricamento non procede.',
      eventId: 'message-1',
    });

    expect(staffNotifications.save).toHaveBeenCalledTimes(1);
    expect(queue.add).toHaveBeenCalledWith(
      'send',
      expect.objectContaining({
        recipient: 'support@example.test',
        template: 'support.ticket.staff_activity',
      }),
      expect.objectContaining({ jobId: expect.not.stringContaining(':') }),
    );
    expect(queue.add).toHaveBeenCalledWith(
      'send',
      expect.objectContaining({
        recipient: 'eulabconsult@gmail.com',
        template: 'support.ticket.staff_activity',
      }),
      expect.anything(),
    );
  });

  it('creates a user notification and queues the reply email', async () => {
    const notifications = repository();
    const preferences = repository();
    const deliveries = repository();
    const memberships = repository();
    const users = repository();
    const staffUsers = repository();
    const staffNotifications = repository();
    const queue = { add: jest.fn(async () => undefined) };
    users.findOneBy.mockResolvedValue({ id: 'user-1', email: 'client@example.test' });
    const service = new NotificationsService(
      notifications as never,
      preferences as never,
      deliveries as never,
      memberships as never,
      users as never,
      staffUsers as never,
      staffNotifications as never,
      queue as never,
      { supportEmail: 'eulabconsult@gmail.com' } as never,
    );

    await service.notifyTicketUser({
      userId: 'user-1',
      ticketId: 'ticket-1',
      workspaceId: 'workspace-1',
      subject: 'Upload bloccato',
      body: 'Abbiamo risolto il problema.',
      eventId: 'message-2',
    });

    expect(notifications.save).toHaveBeenCalledTimes(1);
    expect(queue.add).toHaveBeenCalledWith(
      'send',
      expect.objectContaining({
        recipient: 'client@example.test',
        template: 'support.ticket.user_reply',
      }),
      expect.objectContaining({ jobId: expect.not.stringContaining(':') }),
    );
  });

  it('emails the user on ticket opening and status changes', async () => {
    const notifications = repository();
    const preferences = repository();
    const deliveries = repository();
    const memberships = repository();
    const users = repository();
    const staffUsers = repository();
    const staffNotifications = repository();
    const queue = { add: jest.fn(async () => undefined) };
    users.findOneBy.mockResolvedValue({ id: 'user-1', email: 'client@example.test' });
    const service = new NotificationsService(
      notifications as never,
      preferences as never,
      deliveries as never,
      memberships as never,
      users as never,
      staffUsers as never,
      staffNotifications as never,
      queue as never,
      { supportEmail: 'eulabconsult@gmail.com' } as never,
    );

    await service.notifyTicketOpened({
      userId: 'user-1',
      ticketId: 'ticket-1',
      workspaceId: 'workspace-1',
      subject: 'Upload bloccato',
    });
    await service.notifyTicketStatus({
      userId: 'user-1',
      ticketId: 'ticket-1',
      workspaceId: 'workspace-1',
      subject: 'Upload bloccato',
      status: 'Risolto',
      eventId: 'status-resolved',
    });

    expect(queue.add).toHaveBeenCalledWith(
      'send',
      expect.objectContaining({ template: 'support.ticket.opened_confirmation' }),
      expect.anything(),
    );
    expect(queue.add).toHaveBeenCalledWith(
      'send',
      expect.objectContaining({
        template: 'support.ticket.status_changed',
        variables: expect.objectContaining({ status: 'Risolto' }),
      }),
      expect.anything(),
    );
  });
});
