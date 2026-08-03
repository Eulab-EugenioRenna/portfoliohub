import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { open, rm } from 'node:fs/promises';
import { Inject, Injectable } from '@nestjs/common';
import {
  KEY_PROVIDER,
  type KeyProvider,
  STORAGE_PROVIDER,
  type StorageProvider,
  type WrappedKey,
} from '../adapters/contracts';

const MAGIC = Buffer.from('PHUB1');
const CHUNK_SIZE = 8 * 1024 * 1024;
const HEADER_SIZE = MAGIC.length + 4 + 8;
const FRAME_OVERHEAD = 4 + 16;

@Injectable()
export class FileEncryptionService {
  constructor(
    @Inject(KEY_PROVIDER) private readonly keys: KeyProvider,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  async encryptAndStore(
    sourcePath: string,
    objectKey: string,
  ): Promise<{ checksum: string; wrappedKey: WrappedKey }> {
    const encryptedPath = `${sourcePath}.encrypted`;
    const source = await open(sourcePath, 'r');
    const destination = await open(encryptedPath, 'wx');
    const dataKey = randomBytes(32);
    const noncePrefix = randomBytes(8);
    const header = Buffer.alloc(HEADER_SIZE);
    MAGIC.copy(header, 0);
    header.writeUInt32BE(CHUNK_SIZE, MAGIC.length);
    noncePrefix.copy(header, MAGIC.length + 4);
    const digest = createHash('sha256');
    const encryptedDigest = createHash('sha256');

    try {
      await destination.write(header);
      encryptedDigest.update(header);
      let sourcePosition = 0;
      let destinationPosition = HEADER_SIZE;
      let chunkIndex = 0;
      while (true) {
        const plaintext = Buffer.allocUnsafe(CHUNK_SIZE);
        const { bytesRead } = await source.read(plaintext, 0, CHUNK_SIZE, sourcePosition);
        if (bytesRead === 0) break;
        const chunk = plaintext.subarray(0, bytesRead);
        digest.update(chunk);
        const nonce = Buffer.alloc(12);
        noncePrefix.copy(nonce, 0);
        nonce.writeUInt32BE(chunkIndex, 8);
        const cipher = createCipheriv('aes-256-gcm', dataKey, nonce);
        const ciphertext = Buffer.concat([cipher.update(chunk), cipher.final()]);
        const frame = Buffer.allocUnsafe(FRAME_OVERHEAD + ciphertext.length);
        frame.writeUInt32BE(bytesRead, 0);
        ciphertext.copy(frame, 4);
        cipher.getAuthTag().copy(frame, 4 + ciphertext.length);
        await destination.write(frame, 0, frame.length, destinationPosition);
        encryptedDigest.update(frame);
        sourcePosition += bytesRead;
        destinationPosition += frame.length;
        chunkIndex += 1;
      }
      await destination.sync();
      await this.storage.putFile(objectKey, encryptedPath, encryptedDigest.digest('hex'));
      return { checksum: digest.digest('hex'), wrappedKey: await this.keys.wrap(dataKey) };
    } finally {
      dataKey.fill(0);
      await source.close();
      await destination.close();
      await rm(encryptedPath, { force: true });
    }
  }

  async *decryptRange(input: {
    objectKey: string;
    wrappedKey: WrappedKey;
    plaintextSize: number;
    start: number;
    end: number;
  }): AsyncGenerator<Buffer> {
    const dataKey = await this.keys.unwrap(input.wrappedKey);
    try {
      const header = await this.storage.read(input.objectKey, { start: 0, end: HEADER_SIZE - 1 });
      if (!header.subarray(0, MAGIC.length).equals(MAGIC))
        throw new Error('Formato oggetto non valido');
      const chunkSize = header.readUInt32BE(MAGIC.length);
      const noncePrefix = header.subarray(MAGIC.length + 4, HEADER_SIZE);
      const firstChunk = Math.floor(input.start / chunkSize);
      const lastChunk = Math.floor(input.end / chunkSize);
      for (let index = firstChunk; index <= lastChunk; index += 1) {
        const plaintextLength = Math.min(chunkSize, input.plaintextSize - index * chunkSize);
        const frameStart = HEADER_SIZE + index * (chunkSize + FRAME_OVERHEAD);
        const frame = await this.storage.read(input.objectKey, {
          start: frameStart,
          end: frameStart + FRAME_OVERHEAD + plaintextLength - 1,
        });
        const declaredLength = frame.readUInt32BE(0);
        if (declaredLength !== plaintextLength) throw new Error('Frame cifrato non valido');
        const nonce = Buffer.alloc(12);
        noncePrefix.copy(nonce, 0);
        nonce.writeUInt32BE(index, 8);
        const decipher = createDecipheriv('aes-256-gcm', dataKey, nonce);
        decipher.setAuthTag(frame.subarray(4 + plaintextLength));
        const plaintext = Buffer.concat([
          decipher.update(frame.subarray(4, 4 + plaintextLength)),
          decipher.final(),
        ]);
        const sliceStart = index === firstChunk ? input.start - index * chunkSize : 0;
        const sliceEnd = index === lastChunk ? input.end - index * chunkSize + 1 : plaintext.length;
        yield plaintext.subarray(sliceStart, sliceEnd);
      }
    } finally {
      dataKey.fill(0);
    }
  }
}
