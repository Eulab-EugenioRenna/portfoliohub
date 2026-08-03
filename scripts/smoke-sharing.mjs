import { existsSync, readFileSync } from 'node:fs';

const baseUrl = process.env.SHARING_BASE_URL ?? 'http://localhost:8080';
const parsedBaseUrl = new URL(baseUrl);
const localTarget = ['localhost', '127.0.0.1', '::1'].includes(parsedBaseUrl.hostname);
if (!localTarget && process.env.SHARING_ALLOW_REMOTE !== 'true') {
  throw new Error('Target remoto bloccato. Imposta SHARING_ALLOW_REMOTE=true in modo esplicito.');
}
if (process.env.SHARING_ALLOW_MUTATIONS !== 'true') {
  throw new Error('Smoke test mutante bloccato. Imposta SHARING_ALLOW_MUTATIONS=true.');
}

const localEnv = localTarget ? readLocalEnv() : {};
const accountEmail = process.env.SHARING_EMAIL ?? 'portfoliohub-storage-stress@localhost.test';
const accountPassword = process.env.SHARING_PASSWORD ?? 'PortfolioHub-Stress-2026!';
const collaboratorEmail =
  process.env.SHARING_COLLABORATOR_EMAIL ?? 'portfoliohub-sharing-collaborator@localhost.test';
const collaboratorPassword =
  process.env.SHARING_COLLABORATOR_PASSWORD ?? 'PortfolioHub-Collaborator-2026!';
const adminEmail =
  process.env.SHARING_ADMIN_EMAIL ?? localEnv.ADMIN_EMAIL ?? 'admin@portfoliohub.test';
const adminPassword =
  process.env.SHARING_ADMIN_PASSWORD ??
  localEnv.ADMIN_PASSWORD ??
  'change-this-local-admin-password';
const runId = Date.now().toString(36);

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
const collaboratorJar = new CookieJar();
const staffJar = new CookieJar();
const anonymousJar = new CookieJar();

async function request(path, options = {}) {
  const { jar = userJar, expected = [200], csrf = false, staff = false, ...fetchOptions } = options;
  const headers = new Headers(fetchOptions.headers);
  const cookie = jar.header();
  if (cookie) headers.set('cookie', cookie);
  if (csrf) {
    const token = jar.get(staff ? 'ph_staff_csrf' : 'ph_csrf');
    if (!token) throw new Error(`Cookie CSRF assente per ${path}`);
    headers.set(staff ? 'x-staff-csrf-token' : 'x-csrf-token', token);
  }
  const response = await fetch(new URL(path, baseUrl), { ...fetchOptions, headers });
  jar.capture(response.headers);
  if (!expected.includes(response.status)) {
    const body = await response.text();
    throw new Error(`${fetchOptions.method ?? 'GET'} ${path}: HTTP ${response.status} ${body}`);
  }
  return response;
}

async function json(path, options = {}) {
  const response = await request(path, options);
  return response.json();
}

async function loginAccount(email, password, jar) {
  let revokeSessionId;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const response = await request('/api/v1/auth/login', {
      method: 'POST',
      jar,
      expected: [200, 201, 401, 409],
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        ...(revokeSessionId ? { revokeSessionId } : {}),
      }),
    });
    if (response.status === 200 || response.status === 201) return true;
    if (response.status === 401) return false;
    const conflict = await response.json();
    revokeSessionId =
      conflict.code === 'SESSION_LIMIT_REACHED' ? conflict.sessions?.[0]?.id : undefined;
    if (!revokeSessionId) return false;
  }
  return false;
}

async function ensureStaffSession() {
  if (staffJar.get('ph_staff_session')) return;
  await json('/api/v1/admin/auth/login', {
    method: 'POST',
    jar: staffJar,
    staff: true,
    expected: [200, 201],
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: adminEmail, password: adminPassword }),
  });
}

async function createTechnicalAccount({ email, password, displayName, workspaceName }) {
  await ensureStaffSession();
  const created = await json('/api/v1/admin/accounts', {
    method: 'POST',
    jar: staffJar,
    staff: true,
    csrf: true,
    expected: [200, 201],
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email,
      password,
      displayName,
      workspaceName,
      workspaceType: 'studio',
    }),
  });
  await request(`/api/v1/admin/accounts/${created.userId}/verify`, {
    method: 'POST',
    jar: staffJar,
    staff: true,
    csrf: true,
    expected: [200, 201],
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ reason: 'Account tecnico per smoke test condivisione locale' }),
  });
  return created;
}

async function ensureAccount() {
  if (await loginAccount(accountEmail, accountPassword, userJar)) return;
  const created = await createTechnicalAccount({
    email: accountEmail,
    password: accountPassword,
    displayName: 'PortfolioHub Sharing Smoke',
    workspaceName: 'Sharing Smoke Workspace',
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
      reason: 'Piano tecnico per smoke test condivisione locale',
    }),
  });
  if (!(await loginAccount(accountEmail, accountPassword, userJar)))
    throw new Error('Login account tecnico non riuscito');
}

async function ensureCollaboratorAccount() {
  if (await loginAccount(collaboratorEmail, collaboratorPassword, collaboratorJar)) return;
  await createTechnicalAccount({
    email: collaboratorEmail,
    password: collaboratorPassword,
    displayName: 'PortfolioHub Collaborator Smoke',
    workspaceName: 'Collaborator Personal Workspace',
  });
  if (!(await loginAccount(collaboratorEmail, collaboratorPassword, collaboratorJar)))
    throw new Error('Login collaboratore tecnico non riuscito');
}

function assert(condition, message) {
  if (!condition) throw new Error(`Verifica fallita: ${message}`);
}

async function ensureProject(workspaceId) {
  const projects = await json(`/api/v1/workspaces/${workspaceId}/projects`);
  const existing = projects.find((project) => project.name === 'Sharing acceptance');
  if (existing) return existing;
  return json(`/api/v1/workspaces/${workspaceId}/projects`, {
    method: 'POST',
    csrf: true,
    expected: [200, 201],
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Sharing acceptance' }),
  });
}

async function uploadFixture(workspaceId, projectId, parentId) {
  const body = Buffer.from(`PortfolioHub sharing ${runId}`);
  const upload = await json(
    `/api/v1/workspaces/${workspaceId}/projects/${projectId}/files/uploads`,
    {
      method: 'POST',
      csrf: true,
      expected: [200, 201],
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        fileName: `condivisione-${runId}.txt`,
        mimeType: 'text/plain',
        size: body.byteLength,
        parentId,
      }),
    },
  );
  await request(upload.uploadUrl, {
    method: 'PATCH',
    csrf: true,
    expected: [204],
    headers: {
      'content-type': 'application/octet-stream',
      'upload-offset': '0',
      'content-length': String(body.byteLength),
    },
    body,
  });
  const startedAt = Date.now();
  while (Date.now() - startedAt < 30_000) {
    const status = await request(upload.uploadUrl, { method: 'HEAD', expected: [204] });
    if (status.headers.get('upload-status') === 'completed') {
      const nodeId = status.headers.get('upload-file-node-id');
      assert(nodeId, 'node file finalizzato');
      return { nodeId, body };
    }
    if (status.headers.get('upload-status') === 'failed')
      throw new Error('Finalizzazione file fixture fallita');
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Timeout finalizzazione file fixture');
}

async function run() {
  await ensureAccount();
  await ensureCollaboratorAccount();
  const workspaces = await json('/api/v1/workspaces');
  const workspace = workspaces[0]?.workspace;
  assert(workspace?.id, 'workspace tecnico disponibile');
  assert(workspace.plan === 'unlimited', 'piano Unlimited applicato');
  const project = await ensureProject(workspace.id);
  const folder = await json(
    `/api/v1/workspaces/${workspace.id}/projects/${project.id}/files/folders`,
    {
      method: 'POST',
      csrf: true,
      expected: [200, 201],
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: `Condivisione ${runId}` }),
    },
  );
  const fixture = await uploadFixture(workspace.id, project.id, folder.id);
  let delivery;
  let oneShotDelivery;
  let invite;
  let disposableProject;
  let disposableClient;
  try {
    const password = `Link-${runId}-sicuro`;
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const created = await json(`/api/v1/workspaces/${workspace.id}/deliveries`, {
      method: 'POST',
      csrf: true,
      expected: [200, 201],
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        projectId: project.id,
        title: `Consegna smoke ${runId}`,
        nodeIds: [folder.id],
        allowDownload: true,
        allowComments: true,
        allowApproval: true,
        oneShot: false,
        password,
        expiresAt,
        maxDownloads: 3,
      }),
    });
    delivery = created.delivery;
    assert(created.url?.startsWith('/d/'), 'URL pubblico restituito');
    const token = created.url.slice('/d/'.length);
    const info = await json(`/api/v1/public/deliveries/${token}`, { jar: anonymousJar });
    assert(info.passwordRequired === true, 'password richiesta dal link');
    assert(info.title === `Consegna smoke ${runId}`, 'titolo pubblico corretto');
    await request(`/api/v1/public/deliveries/${token}/access`, {
      method: 'POST',
      jar: anonymousJar,
      expected: [403],
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: 'password-errata' }),
    });
    const access = await json(`/api/v1/public/deliveries/${token}/access`, {
      method: 'POST',
      jar: anonymousJar,
      expected: [200, 201],
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    assert(access.permissions.comments === true, 'permesso commenti attivo');
    assert(access.permissions.approval === true, 'permesso approvazione attivo');
    assert(
      access.content.some((item) => item.nodeId === folder.id),
      'cartella nello snapshot',
    );
    for (let downloadIndex = 0; downloadIndex < 3; downloadIndex += 1) {
      const fileGrant = await json(`/api/v1/public/deliveries/files/${fixture.nodeId}/grant`, {
        method: 'POST',
        jar: anonymousJar,
        expected: [200, 201],
        headers: { 'x-delivery-grant': access.grant },
      });
      const publicDownload = await request('/api/v1/public/deliveries/files/download/content', {
        jar: anonymousJar,
        headers: { 'x-file-grant': fileGrant.grant },
      });
      assert(
        publicDownload.headers.get('content-disposition')?.includes(`condivisione-${runId}.txt`),
        'download pubblico mantiene il nome originale',
      );
      assert(
        Buffer.compare(Buffer.from(await publicDownload.arrayBuffer()), fixture.body) === 0,
        'download pubblico mantiene il contenuto originale',
      );
    }
    const blockedGrant = await json(`/api/v1/public/deliveries/files/${fixture.nodeId}/grant`, {
      method: 'POST',
      jar: anonymousJar,
      expected: [200, 201],
      headers: { 'x-delivery-grant': access.grant },
    });
    await request('/api/v1/public/deliveries/files/download/content', {
      jar: anonymousJar,
      expected: [409],
      headers: { 'x-file-grant': blockedGrant.grant },
    });
    await json('/api/v1/public/deliveries/feedback/comments', {
      method: 'POST',
      jar: anonymousJar,
      expected: [200, 201],
      headers: { 'content-type': 'application/json', 'x-delivery-grant': access.grant },
      body: JSON.stringify({ authorName: 'Cliente smoke', body: 'Materiale ricevuto.' }),
    });
    await json('/api/v1/public/deliveries/feedback/approval', {
      method: 'POST',
      jar: anonymousJar,
      expected: [200, 201],
      headers: { 'content-type': 'application/json', 'x-delivery-grant': access.grant },
      body: JSON.stringify({
        authorName: 'Cliente smoke',
        decision: 'approved',
        note: 'Consegna approvata.',
      }),
    });
    const feedback = await json('/api/v1/public/deliveries/feedback/list', {
      jar: anonymousJar,
      headers: { 'x-delivery-grant': access.grant },
    });
    assert(feedback.comments.length === 1, 'commento visibile al cliente');
    assert(feedback.approvals.length === 1, 'approvazione visibile al cliente');
    const activity = await json(
      `/api/v1/workspaces/${workspace.id}/deliveries/${delivery.id}/activity`,
    );
    assert(activity.comments[0]?.body === 'Materiale ricevuto.', 'commento visibile allo studio');
    assert(activity.approvals[0]?.decision === 'approved', 'decisione visibile allo studio');
    const deliveries = await json(`/api/v1/workspaces/${workspace.id}/deliveries`);
    const listed = deliveries.find((item) => item.id === delivery.id);
    assert(listed?.url === created.url, 'URL recuperabile dall’hub');
    assert(listed?.commentCount === 1, 'contatore commenti aggiornato');
    assert(listed?.approvalCount === 1, 'contatore approvazioni aggiornato');
    assert(listed?.completedDownloads === 3, 'limite download conteggiato per file completato');

    const oneShot = await json(`/api/v1/workspaces/${workspace.id}/deliveries`, {
      method: 'POST',
      csrf: true,
      expected: [200, 201],
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        projectId: project.id,
        title: `One-shot smoke ${runId}`,
        nodeIds: [fixture.nodeId],
        allowDownload: false,
        allowComments: false,
        allowApproval: false,
        oneShot: true,
      }),
    });
    oneShotDelivery = oneShot.delivery;
    const oneShotToken = oneShot.url.slice('/d/'.length);
    await json(`/api/v1/public/deliveries/${oneShotToken}/access`, {
      method: 'POST',
      jar: anonymousJar,
      expected: [200, 201],
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    await request(`/api/v1/public/deliveries/${oneShotToken}/access`, {
      method: 'POST',
      jar: anonymousJar,
      expected: [409],
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });

    const invitation = await json(`/api/v1/workspaces/${workspace.id}/collaboration-invites`, {
      method: 'POST',
      csrf: true,
      expected: [200, 201],
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: collaboratorEmail,
        role: 'editor',
        projectId: project.id,
        nodeId: fixture.nodeId,
      }),
    });
    invite = invitation.invite;
    assert(invitation.url?.startsWith('/collab/'), 'URL collaboratore restituito');
    const inviteToken = invitation.url.slice('/collab/'.length);
    const preview = await json(`/api/v1/public/collaboration-invites/${inviteToken}`, {
      jar: anonymousJar,
    });
    assert(preview.role === 'editor', 'ruolo collaboratore corretto');
    const invites = await json(`/api/v1/workspaces/${workspace.id}/collaboration-invites`);
    const listedInvite = invites.find((item) => item.id === invite.id);
    assert(listedInvite?.nodeId === fixture.nodeId, 'invito visibile nell’hub');
    assert(listedInvite?.scopeKind === 'file', 'ambito file visibile nell’hub');
    assert(listedInvite?.scopeName === `condivisione-${runId}.txt`, 'nome file visibile nell’hub');

    await json(`/api/v1/public/collaboration-invites/${inviteToken}/accept`, {
      method: 'POST',
      jar: collaboratorJar,
      csrf: true,
      expected: [200, 201],
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    const visibleRoot = await json(
      `/api/v1/workspaces/${workspace.id}/projects/${project.id}/files`,
      { jar: collaboratorJar },
    );
    assert(
      visibleRoot.length === 1 && visibleRoot[0].id === folder.id,
      'il collaboratore vede soltanto il percorso del file',
    );
    const visibleFolder = await json(
      `/api/v1/workspaces/${workspace.id}/projects/${project.id}/files?parentId=${folder.id}`,
      { jar: collaboratorJar },
    );
    assert(
      visibleFolder.length === 1 && visibleFolder[0].id === fixture.nodeId,
      'il collaboratore vede soltanto il file condiviso',
    );
    const downloaded = await request(
      `/api/v1/workspaces/${workspace.id}/projects/${project.id}/files/${fixture.nodeId}/download`,
      { jar: collaboratorJar },
    );
    assert(
      Buffer.compare(Buffer.from(await downloaded.arrayBuffer()), fixture.body) === 0,
      'il collaboratore scarica il file autorizzato',
    );

    await request(`/api/v1/workspaces/${workspace.id}/collaboration-invites/${invite.id}`, {
      method: 'DELETE',
      csrf: true,
      expected: [200, 204],
    });
    invite = null;
    await request(`/api/v1/workspaces/${workspace.id}/projects/${project.id}/files`, {
      jar: collaboratorJar,
      expected: [403],
    });
    await request(`/api/v1/workspaces/${workspace.id}/deliveries/${delivery.id}`, {
      method: 'DELETE',
      csrf: true,
      expected: [200, 204],
    });
    await request(`/api/v1/public/deliveries/${token}`, {
      jar: anonymousJar,
      expected: [404],
    });
    await request(`/api/v1/workspaces/${workspace.id}/deliveries/${delivery.id}/permanent`, {
      method: 'DELETE',
      csrf: true,
      expected: [200, 204],
    });
    const deliveriesAfterDelete = await json(`/api/v1/workspaces/${workspace.id}/deliveries`);
    assert(
      !deliveriesAfterDelete.some((item) => item.id === delivery.id),
      'il link eliminato scompare dalla consegna',
    );
    delivery = null;
    await request(`/api/v1/workspaces/${workspace.id}/deliveries/${oneShotDelivery.id}/permanent`, {
      method: 'DELETE',
      csrf: true,
      expected: [200, 204],
    });
    oneShotDelivery = null;

    disposableClient = await json(`/api/v1/workspaces/${workspace.id}/clients`, {
      method: 'POST',
      csrf: true,
      expected: [200, 201],
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: `Cliente eliminabile ${runId}`,
        email: `delete-${runId}@example.test`,
      }),
    });
    disposableProject = await json(`/api/v1/workspaces/${workspace.id}/projects`, {
      method: 'POST',
      csrf: true,
      expected: [200, 201],
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: `Progetto eliminabile ${runId}`,
        clientId: disposableClient.id,
      }),
    });
    await request(`/api/v1/workspaces/${workspace.id}/clients/${disposableClient.id}`, {
      method: 'DELETE',
      csrf: true,
      expected: [200, 204],
    });
    const projectsAfterClientDelete = await json(`/api/v1/workspaces/${workspace.id}/projects`);
    assert(
      projectsAfterClientDelete.find((item) => item.id === disposableProject.id)?.clientId === null,
      'eliminare il cliente scollega il progetto senza eliminarlo',
    );
    disposableClient = null;
    await request(`/api/v1/workspaces/${workspace.id}/projects/${disposableProject.id}`, {
      method: 'DELETE',
      csrf: true,
      expected: [200, 204],
    });
    const projectsAfterDelete = await json(`/api/v1/workspaces/${workspace.id}/projects`);
    assert(
      !projectsAfterDelete.some((item) => item.id === disposableProject.id),
      'il progetto eliminato scompare dalla lista',
    );
    disposableProject = null;
    console.log(
      JSON.stringify({
        ok: true,
        workspaceId: workspace.id,
        projectId: project.id,
        checks: 37,
        flow: [
          'share-dialog contract',
          'public delivery',
          'feedback hub',
          'download limit and original filename',
          'one-shot delivery',
          'file-scoped collaboration',
          'access revocation',
          'delivery deletion',
          'client unlink deletion',
          'project deletion',
        ],
      }),
    );
  } finally {
    if (invite) {
      await request(`/api/v1/workspaces/${workspace.id}/collaboration-invites/${invite.id}`, {
        method: 'DELETE',
        csrf: true,
        expected: [200, 204],
      }).catch(() => undefined);
    }
    if (delivery) {
      await request(`/api/v1/workspaces/${workspace.id}/deliveries/${delivery.id}/permanent`, {
        method: 'DELETE',
        csrf: true,
        expected: [200, 204],
      }).catch(() => undefined);
    }
    if (oneShotDelivery) {
      await request(
        `/api/v1/workspaces/${workspace.id}/deliveries/${oneShotDelivery.id}/permanent`,
        {
          method: 'DELETE',
          csrf: true,
          expected: [200, 204],
        },
      ).catch(() => undefined);
    }
    if (disposableClient) {
      await request(`/api/v1/workspaces/${workspace.id}/clients/${disposableClient.id}`, {
        method: 'DELETE',
        csrf: true,
        expected: [200, 204],
      }).catch(() => undefined);
    }
    if (disposableProject) {
      await request(`/api/v1/workspaces/${workspace.id}/projects/${disposableProject.id}`, {
        method: 'DELETE',
        csrf: true,
        expected: [200, 204],
      }).catch(() => undefined);
    }
    await request(`/api/v1/workspaces/${workspace.id}/projects/${project.id}/files/${folder.id}`, {
      method: 'DELETE',
      csrf: true,
      expected: [200, 204],
    }).catch(() => undefined);
  }
}

function readLocalEnv() {
  if (!existsSync('.env')) return {};
  const result = {};
  for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator <= 0) continue;
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
