import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, type Repository } from 'typeorm';
import { EMAIL_PROVIDER, type EmailProvider } from '../adapters/contracts';
import { integrationsConfig } from '../config/integrations.config';
import { DeliveriesService } from '../deliveries/deliveries.service';
import { ClientEntity } from '../projects/entities/client.entity';
import { WorkspacesService } from '../workspaces/workspaces.service';
import type { ClientEmailDto, MergeClientLinksDto } from './dto/client-portal.dto';
import { ClientAccessLinkEntity } from './entities/client-access-link.entity';
import { ClientAuthTokenEntity } from './entities/client-auth-token.entity';
import { ClientIdentityEntity } from './entities/client-identity.entity';
import { ClientLinkClaimEntity } from './entities/client-link-claim.entity';
import { ClientSessionEntity } from './entities/client-session.entity';

@Injectable()
export class ClientPortalService {
  constructor(
    private readonly database: DataSource,
    @InjectRepository(ClientAccessLinkEntity)
    private readonly links: Repository<ClientAccessLinkEntity>,
    @InjectRepository(ClientAuthTokenEntity)
    private readonly authTokens: Repository<ClientAuthTokenEntity>,
    @InjectRepository(ClientSessionEntity)
    private readonly sessions: Repository<ClientSessionEntity>,
    private readonly workspaces: WorkspacesService,
    private readonly deliveries: DeliveriesService,
    @Inject(integrationsConfig.KEY) private readonly config: ConfigType<typeof integrationsConfig>,
    @Inject(EMAIL_PROVIDER) private readonly email: EmailProvider,
  ) {}

  async createPersonalLink(
    workspaceId: string,
    clientId: string,
    userId: string,
  ): Promise<{ url: string }> {
    await this.workspaces.assertRole(workspaceId, userId, ['owner', 'admin', 'editor']);
    const client = await this.database
      .getRepository(ClientEntity)
      .findOneBy({ id: clientId, workspaceId });
    if (!client?.email) throw new ConflictException('Il cliente deve avere un indirizzo email');
    const token = randomBytes(32).toString('base64url');
    const link = await this.links.save(
      this.links.create({
        id: randomUUID(),
        workspaceId,
        clientId,
        tokenHash: this.hash(token),
        createdBy: userId,
        createdAt: new Date(),
        revokedAt: null,
      }),
    );
    await this.email.send({
      idempotencyKey: `client-personal-link:${link.id}`,
      to: client.email,
      template: 'client-personal-link',
      locale: 'it',
      variables: { clientName: client.name, url: `/cliente/${token}` },
    });
    return { url: `/cliente/${token}` };
  }

  async linkInfo(token: string): Promise<{ workspaceName: string; clientName: string }> {
    const row = await this.database.query<Array<{ workspaceName: string; clientName: string }>>(
      `SELECT workspace.name AS "workspaceName", client.name AS "clientName"
       FROM client_access_links link JOIN workspaces workspace ON workspace.id = link.workspace_id
       JOIN clients client ON client.id = link.client_id
       WHERE link.token_hash = $1 AND link.revoked_at IS NULL AND workspace.status = 'active'`,
      [this.hash(token)],
    );
    if (!row[0]) throw new NotFoundException('Link cliente non disponibile');
    return row[0];
  }

  async requestLogin(dto: ClientEmailDto): Promise<void> {
    if (dto.linkToken) await this.linkInfo(dto.linkToken);
    const token = randomBytes(32).toString('base64url');
    const now = new Date();
    await this.authTokens.save(
      this.authTokens.create({
        id: randomUUID(),
        email: dto.email,
        tokenHash: this.hash(token),
        createdAt: now,
        expiresAt: new Date(now.getTime() + 15 * 60 * 1000),
        consumedAt: null,
      }),
    );
    await this.email.send({
      idempotencyKey: `client-magic:${this.hash(token).slice(0, 16)}`,
      to: dto.email,
      template: 'client-magic-login',
      locale: 'it',
      variables: {
        token,
        url: dto.linkToken
          ? `/cliente/${dto.linkToken}?magic=${encodeURIComponent(token)}`
          : `/cliente/accesso?magic=${encodeURIComponent(token)}`,
      },
    });
  }

  async consumeLogin(
    token: string,
  ): Promise<{ sessionToken: string; csrfToken: string; expiresAt: Date; identityId: string }> {
    const identity = await this.database.transaction('SERIALIZABLE', async (manager) => {
      const tokenRepository = manager.getRepository(ClientAuthTokenEntity);
      const entity = await tokenRepository
        .createQueryBuilder('token')
        .addSelect('token.tokenHash')
        .setLock('pessimistic_write')
        .where('token.tokenHash = :hash', { hash: this.hash(token) })
        .andWhere('token.consumedAt IS NULL')
        .andWhere('token.expiresAt > now()')
        .getOne();
      if (!entity) throw new UnauthorizedException('Magic link non valido o scaduto');
      const identityRepository = manager.getRepository(ClientIdentityEntity);
      let current = await identityRepository
        .createQueryBuilder('identity')
        .where('lower(identity.email) = lower(:email)', { email: entity.email })
        .getOne();
      const now = new Date();
      if (!current)
        current = await identityRepository.save({
          id: randomUUID(),
          email: entity.email,
          displayName: null,
          createdAt: now,
          verifiedAt: now,
        });
      entity.consumedAt = now;
      await tokenRepository.save(entity);
      return current;
    });
    const sessionToken = randomBytes(32).toString('base64url');
    const csrfToken = randomBytes(24).toString('base64url');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    await this.sessions.save({
      id: randomUUID(),
      identityId: identity.id,
      tokenHash: this.hash(sessionToken),
      createdAt: now,
      expiresAt,
      revokedAt: null,
    });
    return { sessionToken, csrfToken, expiresAt, identityId: identity.id };
  }

  async authenticateClient(token: string): Promise<string> {
    const session = await this.sessions
      .createQueryBuilder('session')
      .addSelect('session.tokenHash')
      .where('session.tokenHash = :hash', { hash: this.hash(token) })
      .andWhere('session.revokedAt IS NULL')
      .andWhere('session.expiresAt > now()')
      .getOne();
    if (!session) throw new UnauthorizedException('Sessione cliente scaduta');
    return session.identityId;
  }

  async merge(identityId: string, dto: MergeClientLinksDto): Promise<{ merged: number }> {
    const hashes = dto.linkTokens.map((token) => this.hash(token));
    const links = await this.links
      .createQueryBuilder('link')
      .addSelect('link.tokenHash')
      .where('link.tokenHash IN (:...hashes)', { hashes })
      .andWhere('link.revokedAt IS NULL')
      .getMany();
    if (links.length !== new Set(hashes).size)
      throw new ForbiddenException('Uno o più link non sono validi');
    await this.database.transaction(async (manager) => {
      const claims = manager.getRepository(ClientLinkClaimEntity);
      for (const link of links) {
        const existing = await claims.findOneBy({ accessLinkId: link.id });
        if (existing && existing.identityId !== identityId)
          throw new ConflictException('Link già associato a un altro account cliente');
        if (!existing)
          await claims.save({
            id: randomUUID(),
            identityId,
            accessLinkId: link.id,
            claimedAt: new Date(),
          });
      }
    });
    return { merged: links.length };
  }

  async aggregated(identityId: string): Promise<
    Array<{
      provider: string;
      workspaceId: string;
      deliveries: Array<{ id: string; title: string; status: string; createdAt: string }>;
    }>
  > {
    const rows = await this.database.query<
      Array<{
        workspaceId: string;
        provider: string;
        deliveryId: string | null;
        title: string | null;
        status: string | null;
        createdAt: string | null;
      }>
    >(
      `SELECT workspace.id AS "workspaceId", workspace.name AS provider, delivery.id AS "deliveryId",
              delivery.title, delivery.status, delivery.created_at AS "createdAt"
       FROM client_link_claims claim JOIN client_access_links link ON link.id = claim.access_link_id
       JOIN workspaces workspace ON workspace.id = link.workspace_id
       LEFT JOIN deliveries delivery ON delivery.client_id = link.client_id AND delivery.status = 'active'
       WHERE claim.identity_id = $1 AND link.revoked_at IS NULL
       ORDER BY workspace.name, delivery.created_at DESC`,
      [identityId],
    );
    const providers = new Map<
      string,
      {
        provider: string;
        workspaceId: string;
        deliveries: Array<{ id: string; title: string; status: string; createdAt: string }>;
      }
    >();
    for (const row of rows) {
      const group = providers.get(row.workspaceId) ?? {
        provider: row.provider,
        workspaceId: row.workspaceId,
        deliveries: [],
      };
      if (row.deliveryId && row.title && row.status && row.createdAt)
        group.deliveries.push({
          id: row.deliveryId,
          title: row.title,
          status: row.status,
          createdAt: row.createdAt,
        });
      providers.set(row.workspaceId, group);
    }
    return [...providers.values()];
  }

  async accessDelivery(identityId: string, deliveryId: string) {
    const [allowed] = await this.database.query<Array<{ allowed: boolean }>>(
      `SELECT EXISTS(
        SELECT 1 FROM client_link_claims claim
        JOIN client_access_links link ON link.id = claim.access_link_id
        JOIN deliveries delivery ON delivery.client_id = link.client_id AND delivery.workspace_id = link.workspace_id
        WHERE claim.identity_id = $1 AND delivery.id = $2 AND link.revoked_at IS NULL
      ) AS allowed`,
      [identityId, deliveryId],
    );
    if (!allowed?.allowed)
      throw new ForbiddenException('Consegna non associata a questo account cliente');
    return this.deliveries.issueAuthenticatedPageGrant(deliveryId);
  }

  private hash(value: string): string {
    return createHmac('sha256', this.config.sessionPepper).update(value).digest('hex');
  }
}
