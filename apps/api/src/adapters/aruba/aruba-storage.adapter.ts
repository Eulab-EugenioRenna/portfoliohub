import { createHash, createHmac, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { request as httpRequest, type IncomingHttpHeaders } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { integrationsConfig } from '../../config/integrations.config';
import type { StorageObject, StorageProvider } from '../contracts';

type GatewayResponse = { status: number; headers: IncomingHttpHeaders; body: Buffer };
type ByteRange = { start: number; end: number };

export function extractGatewayRange(response: GatewayResponse, range: ByteRange): Buffer {
  const expectedLength = range.end - range.start + 1;
  const expectedContentRange = `bytes ${range.start}-${range.end}/`;
  const contentRange = String(response.headers['content-range'] ?? '');

  if (
    response.status === 206 &&
    contentRange.startsWith(expectedContentRange) &&
    response.body.byteLength === expectedLength
  ) {
    return response.body;
  }

  throw new Error(
    `Gateway Aruba: risposta Range non valida (${response.status}, ricevuti ${response.body.byteLength} byte)`,
  );
}

export function encodeGatewayDeleteBatch(keys: string[]): Buffer {
  return Buffer.from(
    JSON.stringify({ keys: keys.map((key) => Buffer.from(key).toString('base64url')) }),
  );
}

@Injectable()
export class ArubaStorageAdapter implements StorageProvider {
  constructor(
    @Inject(integrationsConfig.KEY)
    private readonly config: ConfigType<typeof integrationsConfig>,
  ) {}

  async put(key: string, content: Buffer): Promise<StorageObject> {
    const checksum = createHash('sha256').update(content).digest('hex');
    const response = await this.send('PUT', key, checksum, content.byteLength, (request) => {
      request.end(content);
    });
    this.assertSuccess(response, 'scrittura');
    return this.objectFrom(response, key);
  }

  async putFile(key: string, sourcePath: string, checksum?: string): Promise<StorageObject> {
    const metadata = await stat(sourcePath);
    const contentHash = checksum ?? (await this.hashFile(sourcePath));
    const response = await this.send('PUT', key, contentHash, metadata.size, (request) => {
      const source = createReadStream(sourcePath);
      source.once('error', (error) => request.destroy(error));
      source.pipe(request);
    });
    this.assertSuccess(response, 'scrittura file');
    return this.objectFrom(response, key);
  }

  async read(key: string, range?: ByteRange): Promise<Buffer> {
    const response = await this.send(
      'GET',
      key,
      this.emptyHash(),
      0,
      (request) => request.end(),
      range
        ? {
            Range: `bytes=${range.start}-${range.end}`,
            'X-PH-Range': `bytes=${range.start}-${range.end}`,
          }
        : undefined,
    );
    this.assertSuccess(response, 'lettura');
    return range ? extractGatewayRange(response, range) : response.body;
  }

  async inspect(key: string): Promise<StorageObject | null> {
    // Some shared-hosting proxies normalize HEAD to GET before PHP, invalidating the
    // method-bound HMAC. A one-byte range keeps metadata inspection bounded and signed.
    const response = await this.send('GET', key, this.emptyHash(), 0, (request) => request.end(), {
      Range: 'bytes=0-0',
      'X-PH-Range': 'bytes=0-0',
    });
    if (response.status === 404) return null;
    this.assertSuccess(response, 'ispezione');
    return this.objectFrom(response, key);
  }

  async delete(key: string): Promise<void> {
    const response = await this.send('DELETE', key, this.emptyHash(), 0, (request) =>
      request.end(),
    );
    this.assertSuccess(response, 'cancellazione');
  }

  async deleteMany(keys: string[]): Promise<void> {
    const batchSize = this.config.storageDeleteBatchSize;
    for (let offset = 0; offset < keys.length; offset += batchSize) {
      const body = encodeGatewayDeleteBatch(keys.slice(offset, offset + batchSize));
      const checksum = createHash('sha256').update(body).digest('hex');
      const response = await this.sendPath(
        'POST',
        'v1/objects/batch-delete',
        checksum,
        body.byteLength,
        (request) => request.end(body),
        { 'Content-Type': 'application/json' },
      );
      this.assertSuccess(response, 'cancellazione batch');
    }
  }

  private async send(
    method: string,
    key: string,
    contentHash: string,
    contentLength: number,
    write: (request: ReturnType<typeof httpRequest>) => void,
    extraHeaders: Record<string, string> = {},
  ): Promise<GatewayResponse> {
    return this.sendPath(
      method,
      `v1/objects/${Buffer.from(key).toString('base64url')}`,
      contentHash,
      contentLength,
      write,
      extraHeaders,
    );
  }

  private async sendPath(
    method: string,
    path: string,
    contentHash: string,
    contentLength: number,
    write: (request: ReturnType<typeof httpRequest>) => void,
    extraHeaders: Record<string, string> = {},
  ): Promise<GatewayResponse> {
    const url = new URL(path, this.baseUrl());
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = randomUUID();
    const canonical = [method, `${url.pathname}${url.search}`, timestamp, nonce, contentHash].join(
      '\n',
    );
    const signature = createHmac('sha256', this.config.arubaGatewaySecret)
      .update(canonical)
      .digest('hex');
    const transport = url.protocol === 'https:' ? httpsRequest : httpRequest;

    return new Promise((resolve, reject) => {
      const request = transport(url, {
        method,
        headers: {
          'Content-Length': contentLength,
          'X-PH-Key-Id': this.config.arubaGatewayKeyId,
          'X-PH-Timestamp': timestamp,
          'X-PH-Nonce': nonce,
          'X-PH-Content-SHA256': contentHash,
          'X-PH-Signature': signature,
          ...extraHeaders,
        },
        timeout: 12 * 60 * 60 * 1000,
      });
      request.once('timeout', () => request.destroy(new Error('Timeout gateway Aruba')));
      request.once('error', reject);
      request.once('response', (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer | string) => chunks.push(Buffer.from(chunk)));
        response.once('end', () =>
          resolve({
            status: response.statusCode ?? 500,
            headers: response.headers,
            body: Buffer.concat(chunks),
          }),
        );
        response.once('error', reject);
      });
      write(request);
    });
  }

  private baseUrl(): string {
    return `${this.config.arubaGatewayUrl.replace(/\/+$/, '')}/`;
  }

  private assertSuccess(response: GatewayResponse, operation: string): void {
    if (response.status >= 200 && response.status < 300) return;
    const detail = response.body.toString('utf8').slice(0, 500);
    throw new Error(
      `Gateway Aruba: ${operation} fallita (${response.status})${detail ? `: ${detail}` : ''}`,
    );
  }

  private objectFrom(response: GatewayResponse, key: string): StorageObject {
    const size = Number(response.headers['x-ph-object-size'] ?? response.headers['content-length']);
    const checksum = String(response.headers['x-ph-object-sha256'] ?? '');
    if (!Number.isSafeInteger(size) || size < 0 || !/^[a-f0-9]{64}$/.test(checksum))
      throw new Error('Gateway Aruba: metadati oggetto non validi');
    return { key, size, checksum };
  }

  private emptyHash(): string {
    return createHash('sha256').update('').digest('hex');
  }

  private async hashFile(path: string): Promise<string> {
    const hash = createHash('sha256');
    for await (const chunk of createReadStream(path)) hash.update(chunk);
    return hash.digest('hex');
  }
}
