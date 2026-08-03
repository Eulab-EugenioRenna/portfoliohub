import { createHash, createHmac, randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';

const env = Object.fromEntries(
  (existsSync('.env') ? readFileSync('.env', 'utf8') : '')
    .split(/\r?\n/)
    .map((row) => row.trim())
    .filter((row) => row && !row.startsWith('#') && row.includes('='))
    .map((row) => {
      const separator = row.indexOf('=');
      return [row.slice(0, separator), row.slice(separator + 1).replace(/^['"]|['"]$/g, '')];
    }),
);

const baseUrl = process.env.ARUBA_GATEWAY_URL ?? env.ARUBA_GATEWAY_URL;
const keyId = process.env.ARUBA_GATEWAY_KEY_ID ?? env.ARUBA_GATEWAY_KEY_ID;
const secret = process.env.ARUBA_GATEWAY_SECRET ?? env.ARUBA_GATEWAY_SECRET;
if (!baseUrl || !keyId || !secret) throw new Error('Configurazione Aruba assente');

async function signedRequest(method, path, body = Buffer.alloc(0), timeoutMs = 15_000) {
  const url = new URL(path, `${baseUrl.replace(/\/+$/, '')}/`);
  const timestamp = Math.floor(Date.now() / 1_000).toString();
  const nonce = randomUUID();
  const checksum = createHash('sha256').update(body).digest('hex');
  const canonical = [method, `${url.pathname}${url.search}`, timestamp, nonce, checksum].join('\n');
  const signature = createHmac('sha256', secret).update(canonical).digest('hex');
  const started = performance.now();
  const response = await fetch(url, {
    method,
    headers: {
      'content-type': 'application/json',
      'x-ph-key-id': keyId,
      'x-ph-timestamp': timestamp,
      'x-ph-nonce': nonce,
      'x-ph-content-sha256': checksum,
      'x-ph-signature': signature,
    },
    body: body.byteLength ? body : undefined,
    signal: AbortSignal.timeout(timeoutMs),
  });
  return {
    status: response.status,
    durationMs: Math.round(performance.now() - started),
    body: await response.text(),
  };
}

const missingKey = Buffer.from(`gateway-check-${Date.now()}`).toString('base64url');
const inspect = await signedRequest('GET', `v1/objects/${missingKey}`);
if (inspect.status !== 404)
  throw new Error(`Inspect firmata HTTP ${inspect.status}: ${inspect.body}`);
process.stdout.write(`signed_get=ok status=${inspect.status} duration_ms=${inspect.durationMs}\n`);
const payload = Buffer.from('portfoliohub-gateway-write-check');
const write = await signedRequest('PUT', `v1/objects/${missingKey}`, payload);
if (![200, 201].includes(write.status))
  throw new Error(`PUT firmata HTTP ${write.status}: ${write.body}`);
process.stdout.write(`signed_put=ok status=${write.status} duration_ms=${write.durationMs}\n`);
const batchBody = Buffer.from(JSON.stringify({ keys: [missingKey] }));
const batch = await signedRequest('POST', 'v1/objects/batch-delete', batchBody);
if (batch.status !== 200) throw new Error(`Batch delete HTTP ${batch.status}: ${batch.body}`);
const result = JSON.parse(batch.body);
if (result.deleted + result.missing !== 1)
  throw new Error(`Risposta batch inattesa: ${batch.body}`);
process.stdout.write(`batch_delete=ok status=${batch.status} duration_ms=${batch.durationMs}\n`);
