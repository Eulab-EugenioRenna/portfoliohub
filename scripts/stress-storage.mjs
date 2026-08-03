import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { Readable } from 'node:stream';

const baseUrl = process.env.STRESS_BASE_URL ?? 'http://localhost:8080';
const parsedBaseUrl = new URL(baseUrl);
const localTarget = ['localhost', '127.0.0.1', '::1'].includes(parsedBaseUrl.hostname);
if (!localTarget && process.env.STRESS_ALLOW_REMOTE !== 'true') {
  throw new Error('Target remoto bloccato. Imposta STRESS_ALLOW_REMOTE=true in modo esplicito.');
}
if (process.env.STRESS_ALLOW_MUTATIONS !== 'true') {
  throw new Error('Test mutante bloccato. Imposta STRESS_ALLOW_MUTATIONS=true.');
}

const localEnv = localTarget ? readLocalEnv() : {};
const accountEmail = process.env.STRESS_EMAIL ?? 'portfoliohub-storage-stress@localhost.test';
const accountPassword = process.env.STRESS_PASSWORD ?? 'PortfolioHub-Stress-2026!';
const adminEmail =
  process.env.STRESS_ADMIN_EMAIL ?? localEnv.ADMIN_EMAIL ?? 'admin@portfoliohub.test';
const adminPassword =
  process.env.STRESS_ADMIN_PASSWORD ??
  localEnv.ADMIN_PASSWORD ??
  'change-this-local-admin-password';
const levels = (process.env.STRESS_LEVELS ?? '1,2,4,8,16,32')
  .split(',')
  .map(Number)
  .filter((value) => Number.isInteger(value) && value > 0);
const iterations = positiveInteger(process.env.STRESS_ITERATIONS, 1);
const fileBytes = positiveInteger(process.env.STRESS_FILE_BYTES, 256 * 1024);
const finalizeTimeoutMs = positiveInteger(
  process.env.STRESS_FINALIZE_TIMEOUT_MS,
  12 * 60 * 60 * 1_000,
);
const finalizeP95LimitMs = positiveInteger(process.env.STRESS_FINALIZE_P95_MS, finalizeTimeoutMs);
const readP95LimitMs = positiveInteger(
  process.env.STRESS_READ_P95_MS,
  fileBytes >= 100 * 1024 * 1024 ? 120_000 : 2_000,
);
const pollIntervalMs = positiveInteger(process.env.STRESS_POLL_INTERVAL_MS, 1_000);
const stopOnFail = process.env.STRESS_STOP_ON_FAIL !== 'false';
const monitorDocker = localTarget && process.env.STRESS_MONITOR_DOCKER !== 'false';
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const reportPath =
  process.env.STRESS_REPORT_PATH ?? join(tmpdir(), `portfoliohub-storage-stress-${runId}.json`);
const records = [];
const dockerSamples = [];
const monitoredContainers = monitorDocker ? dockerContainers() : [];

class CookieJar {
  values = new Map();

  capture(headers) {
    const rows =
      headers.getSetCookie?.() ?? (headers.get('set-cookie') ? [headers.get('set-cookie')] : []);
    for (const row of rows) {
      const [pair] = row.split(';', 1);
      const separator = pair.indexOf('=');
      if (separator > 0) this.values.set(pair.slice(0, separator), pair.slice(separator + 1));
    }
  }

  header() {
    return [...this.values].map(([name, value]) => `${name}=${value}`).join('; ');
  }

  get(name) {
    return this.values.get(name);
  }
}

const userJar = new CookieJar();
const staffJar = new CookieJar();

async function request(path, options = {}) {
  const {
    jar = userJar,
    phase = 'setup',
    expected = [200],
    csrf = false,
    staff = false,
    record = true,
    ...fetchOptions
  } = options;
  const headers = new Headers(fetchOptions.headers);
  const cookie = jar.header();
  if (cookie) headers.set('cookie', cookie);
  if (csrf) {
    const token = jar.get(staff ? 'ph_staff_csrf' : 'ph_csrf');
    if (!token) throw new Error(`Cookie CSRF assente per ${phase}`);
    headers.set(staff ? 'x-staff-csrf-token' : 'x-csrf-token', token);
  }
  const started = performance.now();
  let response;
  let failure;
  try {
    response = await fetch(new URL(path, baseUrl), { ...fetchOptions, headers });
    jar.capture(response.headers);
    if (!expected.includes(response.status)) {
      const body = await response.text();
      throw new Error(`${phase}: HTTP ${response.status} ${body.slice(0, 240)}`);
    }
    return response;
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error);
    throw error;
  } finally {
    if (record) {
      records.push({
        phase,
        durationMs: round(performance.now() - started),
        status: response?.status ?? 0,
        ok: !failure && !!response && expected.includes(response.status),
        error: failure,
      });
    }
  }
}

async function json(path, options = {}) {
  const response = await request(path, options);
  return response.json();
}

async function ensureStressAccount() {
  const login = await tryUserLogin();
  if (login) return;

  await json('/api/v1/admin/auth/login', {
    method: 'POST',
    jar: staffJar,
    staff: true,
    expected: [200, 201],
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: adminEmail, password: adminPassword }),
    record: false,
  });
  const created = await json('/api/v1/admin/accounts', {
    method: 'POST',
    jar: staffJar,
    staff: true,
    csrf: true,
    expected: [200, 201],
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email: accountEmail,
      password: accountPassword,
      displayName: 'PortfolioHub Storage Stress',
      workspaceName: 'Storage Stress Workspace',
      workspaceType: 'studio',
    }),
    record: false,
  });
  await request(`/api/v1/admin/accounts/${created.userId}/verify`, {
    method: 'POST',
    jar: staffJar,
    staff: true,
    csrf: true,
    expected: [200, 201],
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ reason: 'Account tecnico isolato per stress test storage locale' }),
    record: false,
  });
  await request(`/api/v1/admin/workspaces/${created.workspaceId}/manual-plan`, {
    method: 'POST',
    jar: staffJar,
    staff: true,
    csrf: true,
    expected: [200, 201],
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      plan: 'unlimited',
      reason: 'Quota tecnica isolata per stress test storage locale',
    }),
    record: false,
  });
  if (!(await tryUserLogin()))
    throw new Error('Login account stress non riuscito dopo la creazione');
}

async function tryUserLogin() {
  try {
    let revokeSessionId;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const response = await request('/api/v1/auth/login', {
        method: 'POST',
        expected: [200, 201, 409],
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: accountEmail,
          password: accountPassword,
          ...(revokeSessionId ? { revokeSessionId } : {}),
        }),
        record: false,
      });
      if (response.status !== 409) return true;
      const conflict = await response.json();
      revokeSessionId =
        conflict.code === 'SESSION_LIMIT_REACHED' ? conflict.sessions?.[0]?.id : null;
      if (!revokeSessionId) return false;
    }
    return false;
  } catch {
    return false;
  }
}

async function ensureDataset() {
  const workspaces = await json('/api/v1/workspaces', { record: false });
  const workspaceId = workspaces[0]?.workspace?.id;
  if (!workspaceId) throw new Error('Workspace stress non disponibile');
  const projects = await json(`/api/v1/workspaces/${workspaceId}/projects`, { record: false });
  let project = projects.find((item) => item.name === 'Storage stress test');
  if (!project) {
    project = await json(`/api/v1/workspaces/${workspaceId}/projects`, {
      method: 'POST',
      csrf: true,
      expected: [200, 201],
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Storage stress test' }),
      record: false,
    });
  }
  await clearProject(workspaceId, project.id, false);
  return { workspaceId, projectId: project.id };
}

async function clearProject(workspaceId, projectId, record = true) {
  const nodes = await json(`/api/v1/workspaces/${workspaceId}/projects/${projectId}/files`, {
    phase: 'cleanup.list',
    record,
  });
  await Promise.all(
    nodes.map((node) =>
      request(`/api/v1/workspaces/${workspaceId}/projects/${projectId}/files/${node.id}`, {
        method: 'DELETE',
        csrf: true,
        expected: [200, 204],
        phase: 'cleanup.trash',
        record,
      }),
    ),
  );
  await request(`/api/v1/workspaces/${workspaceId}/projects/${projectId}/files/trash`, {
    method: 'DELETE',
    csrf: true,
    expected: [200, 202, 204],
    phase: 'empty-trash',
    record,
  });
}

async function storageCycle(workspaceId, projectId, wave, worker) {
  const name = `stress-${runId}-${wave}-${worker}.bin`;
  const payload = createPayload(name, fileBytes);
  const upload = await json(
    `/api/v1/workspaces/${workspaceId}/projects/${projectId}/files/uploads`,
    {
      method: 'POST',
      csrf: true,
      expected: [200, 201],
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        fileName: name,
        mimeType: 'application/octet-stream',
        size: fileBytes,
      }),
      phase: 'upload.begin',
    },
  );
  await request(upload.uploadUrl, {
    method: 'PATCH',
    csrf: true,
    expected: [204],
    headers: {
      'content-type': 'application/octet-stream',
      'upload-offset': '0',
      'content-length': String(fileBytes),
    },
    body: payload.stream,
    duplex: 'half',
    phase: 'upload.bytes',
  });
  const expectedDigest = await payload.digest;
  const finalizedAt = performance.now();
  let nodeId;
  while (performance.now() - finalizedAt < finalizeTimeoutMs) {
    const response = await request(upload.uploadUrl, {
      method: 'HEAD',
      expected: [204],
      phase: 'upload.poll',
    });
    const status = response.headers.get('upload-status');
    if (status === 'completed') {
      nodeId = response.headers.get('upload-file-node-id');
      break;
    }
    if (status === 'failed') throw new Error(`Finalizzazione fallita per ${upload.id}`);
    await delay(pollIntervalMs);
  }
  records.push({
    phase: 'upload.finalize',
    durationMs: round(performance.now() - finalizedAt),
    status: nodeId ? 200 : 0,
    ok: !!nodeId,
    error: nodeId ? undefined : 'Timeout finalizzazione',
  });
  if (!nodeId) throw new Error(`Timeout finalizzazione per ${upload.id}`);

  for (const phase of ['read.cold', 'read.warm']) {
    const started = performance.now();
    let response;
    let failure;
    try {
      response = await request(
        `/api/v1/workspaces/${workspaceId}/projects/${projectId}/files/${nodeId}/download`,
        {
          headers: phase === 'read.cold' ? { 'cache-control': 'no-cache' } : {},
          phase,
          record: false,
        },
      );
      const digest = createHash('sha256');
      let receivedBytes = 0;
      for await (const chunk of response.body) {
        const buffer = Buffer.from(chunk);
        digest.update(buffer);
        receivedBytes += buffer.byteLength;
      }
      if (receivedBytes !== fileBytes || digest.digest('hex') !== expectedDigest)
        throw new Error(`${phase}: contenuto differente per ${nodeId}`);
    } catch (error) {
      failure = error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      records.push({
        phase,
        durationMs: round(performance.now() - started),
        status: response?.status ?? 0,
        ok: !failure && response?.ok === true,
        error: failure,
        cacheControl: response?.headers.get('cache-control') ?? null,
        cacheAge: response?.headers.get('age') ?? null,
        cacheStatus: response?.headers.get('x-cache') ?? null,
      });
    }
  }
  await request(`/api/v1/workspaces/${workspaceId}/projects/${projectId}/files/${nodeId}`, {
    method: 'PATCH',
    csrf: true,
    expected: [200],
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: `renamed-${name}` }),
    phase: 'rename',
  });
  await request(`/api/v1/workspaces/${workspaceId}/projects/${projectId}/files/${nodeId}`, {
    method: 'DELETE',
    csrf: true,
    expected: [200, 202, 204],
    phase: 'trash',
  });
}

async function runWave(workspaceId, projectId, concurrency, waveIndex) {
  const recordStart = records.length;
  const started = performance.now();
  const dockerStart = dockerSamples.length;
  const monitor = startDockerMonitor();
  const results = await Promise.allSettled(
    Array.from({ length: concurrency * iterations }, (_, index) =>
      storageCycle(workspaceId, projectId, waveIndex, index),
    ),
  );
  await request(`/api/v1/workspaces/${workspaceId}/projects/${projectId}/files/trash`, {
    method: 'DELETE',
    csrf: true,
    expected: [200, 202, 204],
    phase: 'empty-trash',
  });
  const healthStarted = performance.now();
  const health = await request('/api/v1/health/ready', {
    phase: 'health',
    record: false,
  }).then(
    () => ({ ok: true, durationMs: round(performance.now() - healthStarted) }),
    (error) => ({
      ok: false,
      durationMs: round(performance.now() - healthStarted),
      error: String(error),
    }),
  );
  await stopDockerMonitor(monitor);
  const elapsedMs = round(performance.now() - started);
  const waveRecords = records.slice(recordStart);
  const failedWorkers = results.filter((result) => result.status === 'rejected');
  const summary = summarizeWave(
    concurrency,
    elapsedMs,
    waveRecords,
    dockerSamples.slice(dockerStart),
    failedWorkers,
    health,
  );
  summary.postgresConnections = postgresConnections();
  return summary;
}

function summarizeWave(concurrency, elapsedMs, waveRecords, samples, failedWorkers, health) {
  const phases = Object.fromEntries(
    [...new Set(waveRecords.map((item) => item.phase))].map((phase) => {
      const rows = waveRecords.filter((item) => item.phase === phase);
      const durations = rows.map((item) => item.durationMs).sort((a, b) => a - b);
      return [
        phase,
        {
          count: rows.length,
          errors: rows.filter((item) => !item.ok).length,
          p50Ms: percentile(durations, 50),
          p95Ms: percentile(durations, 95),
          p99Ms: percentile(durations, 99),
          maxMs: durations.at(-1) ?? 0,
        },
      ];
    }),
  );
  const failedRequests = waveRecords.filter((item) => !item.ok).length;
  // Una richiesta fallita rigetta anche il relativo ciclo: sommarli conterebbe due volte
  // lo stesso utente virtuale. `errors` misura i cicli falliti; il dettaglio HTTP resta separato.
  const errors = failedWorkers.length;
  const readP95 = Math.max(phases['read.cold']?.p95Ms ?? 0, phases['read.warm']?.p95Ms ?? 0);
  const metadataMutationP95 = Math.max(
    phases['upload.begin']?.p95Ms ?? 0,
    phases.rename?.p95Ms ?? 0,
    phases.trash?.p95Ms ?? 0,
  );
  const cleanupP95 = phases['empty-trash']?.p95Ms ?? 0;
  const finalizeP95 = phases['upload.finalize']?.p95Ms ?? 0;
  const pass =
    errors === 0 &&
    health.ok &&
    readP95 <= readP95LimitMs &&
    metadataMutationP95 <= 1_500 &&
    cleanupP95 <= 5_000 &&
    finalizeP95 <= finalizeP95LimitMs;
  return {
    concurrency,
    virtualUsers: concurrency * iterations,
    elapsedMs,
    cyclesPerSecond: round((concurrency * iterations * 1_000) / elapsedMs),
    requestsPerSecond: round((waveRecords.length * 1_000) / elapsedMs),
    errors,
    failedRequests,
    pass,
    thresholds: {
      readP95Ms: readP95LimitMs,
      metadataMutationP95Ms: 1_500,
      cleanupP95Ms: 5_000,
      finalizeP95Ms: finalizeP95LimitMs,
    },
    observed: {
      readP95Ms: readP95,
      metadataMutationP95Ms: metadataMutationP95,
      cleanupP95Ms: cleanupP95,
      finalizeP95Ms: finalizeP95,
    },
    cache: cacheSummary(waveRecords),
    health,
    phases,
    resources: summarizeDocker(samples),
    failures: failedWorkers.slice(0, 5).map((item) => String(item.reason)),
  };
}

function startDockerMonitor() {
  if (!monitorDocker || monitoredContainers.length === 0) return null;
  const monitor = { timer: null, pending: null };
  const sample = () => {
    if (monitor.pending) return;
    monitor.pending = new Promise((resolve) => {
      const child = spawn('docker', [
        'stats',
        '--no-stream',
        '--format',
        '{{json .}}',
        ...monitoredContainers,
      ]);
      let output = '';
      child.stdout.on('data', (chunk) => {
        output += chunk.toString();
      });
      child.on('close', () => {
        for (const row of output.split('\n').filter(Boolean)) {
          try {
            dockerSamples.push({ at: new Date().toISOString(), ...JSON.parse(row) });
          } catch {
            // Un campione incompleto non invalida le misure HTTP.
          }
        }
        monitor.pending = null;
        resolve();
      });
    });
  };
  sample();
  monitor.timer = setInterval(sample, 500);
  return monitor;
}

function createPayload(seed, totalBytes) {
  const pattern = createHash('sha256').update(seed).digest();
  const digest = createHash('sha256');
  let resolveDigest;
  const completed = new Promise((resolve) => {
    resolveDigest = resolve;
  });
  async function* chunks() {
    let remaining = totalBytes;
    while (remaining > 0) {
      const size = Math.min(1024 * 1024, remaining);
      const chunk = Buffer.allocUnsafe(size);
      for (let offset = 0; offset < size; offset += pattern.byteLength) {
        pattern.copy(chunk, offset, 0, Math.min(pattern.byteLength, size - offset));
      }
      digest.update(chunk);
      remaining -= size;
      yield chunk;
    }
    resolveDigest(digest.digest('hex'));
  }
  return { stream: Readable.from(chunks()), digest: completed };
}

function dockerContainers() {
  const result = spawnSync('docker', ['compose', 'ps', '--format', 'json'], { encoding: 'utf8' });
  if (result.status !== 0) return [];
  return result.stdout
    .split('\n')
    .filter(Boolean)
    .map((row) => JSON.parse(row))
    .filter((container) =>
      ['api', 'postgres', 'redis', 'rabbitmq', 'preview-worker', 'storage-worker'].includes(
        container.Service,
      ),
    )
    .map((container) => container.Name);
}

async function stopDockerMonitor(monitor) {
  if (!monitor) return;
  clearInterval(monitor.timer);
  if (monitor.pending) await monitor.pending;
}

function cacheSummary(waveRecords) {
  const cold = waveRecords.filter((record) => record.phase === 'read.cold');
  const warm = waveRecords.filter((record) => record.phase === 'read.warm');
  const coldP95 = percentile(
    cold.map((record) => record.durationMs).sort((a, b) => a - b),
    95,
  );
  const warmP95 = percentile(
    warm.map((record) => record.durationMs).sort((a, b) => a - b),
    95,
  );
  return {
    coldP95Ms: coldP95,
    warmP95Ms: warmP95,
    warmSpeedup: warmP95 > 0 ? round(coldP95 / warmP95) : null,
    responseHeaders: [
      ...new Set(
        warm.map((record) =>
          JSON.stringify({
            cacheControl: record.cacheControl,
            age: record.cacheAge,
            xCache: record.cacheStatus,
          }),
        ),
      ),
    ].map((value) => JSON.parse(value)),
  };
}

function summarizeDocker(samples) {
  const byContainer = {};
  for (const sample of samples) {
    const name = sample.Name ?? sample.Container;
    if (!name) continue;
    const cpu = Number.parseFloat(sample.CPUPerc ?? '0');
    const memoryMiB = parseMemoryMiB(sample.MemUsage?.split('/')[0] ?? '0B');
    const current = byContainer[name] ?? { maxCpuPercent: 0, maxMemoryMiB: 0, samples: 0 };
    current.maxCpuPercent = Math.max(current.maxCpuPercent, cpu);
    current.maxMemoryMiB = Math.max(current.maxMemoryMiB, memoryMiB);
    current.samples += 1;
    byContainer[name] = current;
  }
  return byContainer;
}

function postgresConnections() {
  if (!monitorDocker) return null;
  const result = spawnSync(
    'docker',
    [
      'compose',
      'exec',
      '-T',
      'postgres',
      'psql',
      '-U',
      'portfoliohub',
      '-d',
      'portfoliohub',
      '-Atc',
      "select count(*) from pg_stat_activity where datname='portfoliohub';",
    ],
    { encoding: 'utf8' },
  );
  const value = Number.parseInt(result.stdout.trim(), 10);
  return Number.isFinite(value) ? value : null;
}

function readLocalEnv() {
  if (!existsSync('.env')) return {};
  return Object.fromEntries(
    readFileSync('.env', 'utf8')
      .split(/\r?\n/)
      .map((row) => row.trim())
      .filter((row) => row && !row.startsWith('#') && row.includes('='))
      .map((row) => {
        const separator = row.indexOf('=');
        return [row.slice(0, separator), row.slice(separator + 1).replace(/^['"]|['"]$/g, '')];
      }),
  );
}

function percentile(values, requested) {
  if (!values.length) return 0;
  return values[Math.min(values.length - 1, Math.ceil((requested / 100) * values.length) - 1)];
}

function parseMemoryMiB(value) {
  const match = /^([\d.]+)([KMG]i?B)$/i.exec(value.trim());
  if (!match) return 0;
  const amount = Number(match[1]);
  const unit = match[2].toUpperCase();
  if (unit.startsWith('G')) return round(amount * 1024);
  if (unit.startsWith('K')) return round(amount / 1024);
  return round(amount);
}

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function round(value) {
  return Math.round(value * 100) / 100;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let dataset;
const waves = [];
let fatalError;
try {
  await ensureStressAccount();
  dataset = await ensureDataset();
  for (const [index, concurrency] of levels.entries()) {
    const result = await runWave(dataset.workspaceId, dataset.projectId, concurrency, index + 1);
    waves.push(result);
    process.stdout.write(
      `concurrency=${concurrency} pass=${result.pass} errors=${result.errors} ` +
        `read_p95=${result.observed.readP95Ms}ms metadata_p95=${result.observed.metadataMutationP95Ms}ms ` +
        `cleanup_p95=${result.observed.cleanupP95Ms}ms finalize_p95=${result.observed.finalizeP95Ms}ms ` +
        `rps=${result.requestsPerSecond}\n`,
    );
    if (!result.pass && stopOnFail) break;
  }
} catch (error) {
  fatalError =
    error instanceof Error
      ? { message: error.message, stack: error.stack }
      : { message: String(error) };
} finally {
  if (dataset)
    await clearProject(dataset.workspaceId, dataset.projectId, false).catch(() => undefined);
}

const sustainable = waves.filter((wave) => wave.pass).at(-1)?.concurrency ?? 0;
const report = {
  schemaVersion: 2,
  runId,
  target: baseUrl,
  startedAt: runId,
  configuration: {
    levels,
    iterations,
    fileBytes,
    finalizeTimeoutMs,
    finalizeP95LimitMs,
    readP95LimitMs,
    pollIntervalMs,
    stopOnFail,
    monitorDocker,
  },
  dataset,
  sustainableConcurrencyObserved: sustainable,
  waves,
  fatalError,
};
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
process.stdout.write(`report=${reportPath}\n`);
if (fatalError || waves.some((wave) => !wave.pass)) process.exitCode = 1;
