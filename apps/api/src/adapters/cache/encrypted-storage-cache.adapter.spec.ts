import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EncryptedStorageCacheAdapter } from './encrypted-storage-cache.adapter';

describe('EncryptedStorageCacheAdapter', () => {
  let directory: string;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'portfoliohub-cache-'));
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('serve i range dal file cifrato locale dopo il trasferimento all’origine', async () => {
    const content = Buffer.from('oggetto-cifrato-di-prova');
    const source = join(directory, 'source.encrypted');
    await writeFile(source, content);
    const origin = {
      putFile: jest
        .fn()
        .mockResolvedValue({ key: 'object-key', size: content.length, checksum: 'a' }),
      read: jest.fn(),
    };
    const cache = new EncryptedStorageCacheAdapter(
      origin as never,
      {
        localDataPath: directory,
        storageCacheMaxBytes: 1024,
      } as never,
    );

    await cache.putFile('object-key', source, 'a');
    await rm(source);

    await expect(cache.read('object-key', { start: 8, end: 14 })).resolves.toEqual(
      content.subarray(8, 15),
    );
    expect(origin.read).not.toHaveBeenCalled();
  });
});
