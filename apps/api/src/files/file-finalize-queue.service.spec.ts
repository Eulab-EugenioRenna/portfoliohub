import { FileFinalizeQueueService, returningRows } from './file-finalize-queue.service';

describe('returningRows', () => {
  it('normalizza UPDATE RETURNING di PostgreSQL senza trasformare un risultato vuoto in job', () => {
    expect(returningRows<[never] | never>([[], 0] as [never[], number])).toEqual([]);
  });

  it('estrae le righe dal risultato UPDATE RETURNING di TypeORM', () => {
    const row = { uploadId: 'upload-1', attempts: 1 };
    expect(returningRows([[row], 1])).toEqual([row]);
  });

  it('mantiene compatibile il formato a righe semplice', () => {
    const row = { uploadId: 'upload-1', attempts: 1 };
    expect(returningRows([row])).toEqual([row]);
  });
});

describe('FileFinalizeQueueService', () => {
  const config = {
    uploadMaxActivePerAccount: 100,
    uploadMaxActivePerIp: 100,
    fileFinalizeLeaseMs: 60_000,
  };

  it('esclude le sessioni scadute dal limite e accetta il centesimo slot libero', async () => {
    const query = jest.fn().mockResolvedValue([{ account: '99', ip: '99' }]);
    const service = new FileFinalizeQueueService({ query } as never, config as never);

    await expect(service.assertUploadCapacity('account-1', 'ip-1')).resolves.toBeUndefined();
    expect(query.mock.calls[0][0]).toContain('expires_at > now()');
  });

  it('rifiuta atomicamente un nuovo upload quando i 100 slot sono occupati', async () => {
    const query = jest.fn().mockResolvedValue([{ account: '100', ip: '12' }]);
    const service = new FileFinalizeQueueService({ query } as never, config as never);

    await expect(service.assertUploadCapacity('account-1', 'ip-1')).rejects.toMatchObject({
      status: 429,
    });
  });

  it('seleziona il prossimo job per minor carico account e blocca senza collisioni', async () => {
    const job = { uploadId: 'upload-1', accountId: 'account-2', ipHash: 'ip-2', attempts: 1 };
    const query = jest
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([[job], 1]);
    const database = {
      transaction: jest.fn(async (callback: (manager: { query: typeof query }) => unknown) =>
        callback({ query }),
      ),
    };
    const service = new FileFinalizeQueueService(database as never, config as never);

    await expect(service.claim()).resolves.toEqual(job);
    const claimSql = query.mock.calls[1][0];
    expect(claimSql).toContain('ORDER BY COALESCE(account_load.active, 0), queue.queued_at');
    expect(claimSql).toContain('FOR UPDATE OF queue SKIP LOCKED');
  });
});
