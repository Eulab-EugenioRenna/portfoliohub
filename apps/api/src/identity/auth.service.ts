import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import argon2 from 'argon2';
import type { Queue } from 'bullmq';
import { DataSource, IsNull, type Repository } from 'typeorm';
import { EMAIL_PROVIDER, type EmailProvider } from '../adapters/contracts';
import { integrationsConfig } from '../config/integrations.config';
import { OutboxService } from '../events/outbox.service';
import { WorkspaceEntity } from '../workspaces/entities/workspace.entity';
import { WorkspaceMembershipEntity } from '../workspaces/entities/workspace-membership.entity';
import type {
  ChangePasswordDto,
  EmailDto,
  LoginDto,
  ResetPasswordDto,
  SignUpDto,
  TokenDto,
  UpdateProfileDto,
} from './dto/auth.dto';
import { AuthTokenEntity } from './entities/auth-token.entity';
import { SessionEntity } from './entities/session.entity';
import { UserEntity } from './entities/user.entity';
import type { AuthenticatedPrincipal, SessionIssue } from './identity.types';
import { SessionsRepository } from './sessions.repository';
import { UsersRepository } from './users.repository';

@Injectable()
export class AuthService {
  constructor(
    private readonly database: DataSource,
    private readonly users: UsersRepository,
    private readonly sessions: SessionsRepository,
    private readonly outbox: OutboxService,
    @InjectRepository(AuthTokenEntity)
    private readonly authTokens: Repository<AuthTokenEntity>,
    @Inject(integrationsConfig.KEY)
    private readonly config: ConfigType<typeof integrationsConfig>,
    @Inject(EMAIL_PROVIDER)
    private readonly email: EmailProvider,
    @InjectQueue('billing-maintenance') private readonly billingMaintenance: Queue,
  ) {}

  async signUp(dto: SignUpDto): Promise<{ userId: string; workspaceId: string }> {
    const passwordHash = await this.hashPassword(dto.password);
    const created = await this.database.transaction('SERIALIZABLE', async (manager) => {
      const existing = await manager
        .getRepository(UserEntity)
        .createQueryBuilder('user')
        .where('lower(user.email) = lower(:email)', { email: dto.email })
        .getOne();
      if (existing) throw new ConflictException('Email già registrata');

      const now = new Date();
      const trialEndsAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const user = await this.users.save(
        this.users.create(
          {
            id: randomUUID(),
            email: dto.email,
            displayName: dto.displayName.trim(),
            passwordHash,
            status: 'pending',
            emailVerifiedAt: null,
            createdAt: now,
            updatedAt: now,
            deletionScheduledAt: null,
            trialUsedAt: now,
          },
          manager,
        ),
        manager,
      );
      const workspaceRepository = manager.getRepository(WorkspaceEntity);
      const membershipRepository = manager.getRepository(WorkspaceMembershipEntity);
      const workspace = await workspaceRepository.save(
        workspaceRepository.create({
          id: randomUUID(),
          name: dto.workspaceName.trim(),
          slug: await this.uniqueSlug(dto.workspaceName, manager),
          type: dto.workspaceType,
          ownerUserId: user.id,
          plan: 'pro',
          status: 'active',
          trialEndsAt,
          onboardingCompletedAt: null,
          createdAt: now,
          updatedAt: now,
          deletionScheduledAt: null,
        }),
      );
      await membershipRepository.save(
        membershipRepository.create({
          id: randomUUID(),
          workspaceId: workspace.id,
          userId: user.id,
          role: 'owner',
          status: 'active',
          createdAt: now,
        }),
      );
      await this.outbox.record(
        {
          topic: 'identity.user.registered',
          aggregateType: 'User',
          aggregateId: user.id,
          payload: { workspaceId: workspace.id, email: user.email },
        },
        manager,
      );
      return { user, workspace, trialEndsAt };
    });
    await this.billingMaintenance.add(
      'expire-trial',
      { workspaceId: created.workspace.id },
      { jobId: `trial-${created.workspace.id}`, delay: created.trialEndsAt.getTime() - Date.now() },
    );
    await this.sendToken(created.user, 'verify-email', 24 * 60 * 60 * 1000);
    return { userId: created.user.id, workspaceId: created.workspace.id };
  }

  async verifyEmail(
    dto: TokenDto,
    request: { userAgent?: string; ip?: string },
  ): Promise<SessionIssue> {
    const user = await this.consumeToken(dto.token, 'verify-email', async (entity, manager) => {
      const repository = manager.getRepository(UserEntity);
      const current = await repository.findOneByOrFail({ id: entity.userId });
      current.status = 'active';
      current.emailVerifiedAt = new Date();
      current.updatedAt = new Date();
      return repository.save(current);
    });
    return this.issueSession(user, request);
  }

  async login(dto: LoginDto, request: { userAgent?: string; ip?: string }): Promise<SessionIssue> {
    const user = await this.users.findByEmailWithPassword(dto.email);
    const valid = user?.passwordHash ? await argon2.verify(user.passwordHash, dto.password) : false;
    if (!user || !valid) throw new UnauthorizedException('Credenziali non valide');
    if (user.status === 'pending')
      throw new UnauthorizedException('Verifica prima il tuo indirizzo email');
    if (user.status !== 'active' || user.deletionScheduledAt)
      throw new UnauthorizedException('Account non disponibile');
    return this.issueSession(user, request, dto.revokeSessionId);
  }

  async requestMagicLink(dto: EmailDto): Promise<void> {
    const user = await this.users.findByEmailWithPassword(dto.email);
    if (user?.status === 'active' && !user.deletionScheduledAt)
      await this.sendToken(user, 'magic-login', 15 * 60 * 1000);
  }

  async consumeMagicLink(
    dto: TokenDto,
    request: { userAgent?: string; ip?: string },
  ): Promise<SessionIssue> {
    const user = await this.consumeToken(dto.token, 'magic-login', async (entity, manager) =>
      manager.getRepository(UserEntity).findOneByOrFail({ id: entity.userId }),
    );
    return this.issueSession(user, request);
  }

  async requestPasswordReset(dto: EmailDto): Promise<void> {
    const user = await this.users.findByEmailWithPassword(dto.email);
    if (user?.status === 'active') await this.sendToken(user, 'reset-password', 30 * 60 * 1000);
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const passwordHash = await this.hashPassword(dto.password);
    await this.consumeToken(dto.token, 'reset-password', async (entity, manager) => {
      const repository = manager.getRepository(UserEntity);
      const user = await repository.findOneByOrFail({ id: entity.userId });
      user.passwordHash = passwordHash;
      user.updatedAt = new Date();
      await repository.save(user);
      await manager
        .getRepository(SessionEntity)
        .update({ userId: user.id, revokedAt: IsNull() }, { revokedAt: new Date() });
      return user;
    });
  }

  async updateProfile(
    principal: AuthenticatedPrincipal,
    dto: UpdateProfileDto,
  ): Promise<AuthenticatedPrincipal> {
    const user = await this.database.getRepository(UserEntity).findOneByOrFail({
      id: principal.userId,
    });
    user.displayName = dto.displayName.trim();
    user.updatedAt = new Date();
    await this.database.getRepository(UserEntity).save(user);
    return { ...principal, displayName: user.displayName };
  }

  async changePassword(principal: AuthenticatedPrincipal, dto: ChangePasswordDto): Promise<void> {
    const user = await this.users.findByEmailWithPassword(principal.email);
    if (!user?.passwordHash || !(await argon2.verify(user.passwordHash, dto.currentPassword)))
      throw new UnauthorizedException('Password attuale non valida');
    user.passwordHash = await this.hashPassword(dto.newPassword);
    user.updatedAt = new Date();
    await this.users.save(user);
    await this.database
      .getRepository(SessionEntity)
      .createQueryBuilder()
      .update()
      .set({ revokedAt: new Date() })
      .where('user_id = :userId', { userId: principal.userId })
      .andWhere('id <> :sessionId', { sessionId: principal.sessionId })
      .andWhere('revoked_at IS NULL')
      .execute();
  }

  async authenticate(token: string): Promise<AuthenticatedPrincipal> {
    const session = await this.sessions.findActiveByTokenHash(this.tokenHash(token));
    if (!session) throw new UnauthorizedException('Sessione scaduta');
    const user = await this.users.findById(session.userId);
    if (!user || user.status !== 'active')
      throw new UnauthorizedException('Account non disponibile');
    if (Date.now() - session.lastSeenAt.getTime() > 5 * 60 * 1000) {
      session.lastSeenAt = new Date();
      await this.sessions.save(session);
    }
    return {
      userId: user.id,
      sessionId: session.id,
      email: user.email,
      displayName: user.displayName,
    };
  }

  async logout(principal: AuthenticatedPrincipal): Promise<void> {
    await this.sessions.revoke(principal.sessionId, principal.userId);
  }

  listSessions(userId: string): Promise<SessionEntity[]> {
    return this.sessions.listForUser(userId);
  }

  revokeSession(userId: string, sessionId: string): Promise<void> {
    return this.sessions.revoke(sessionId, userId);
  }

  async revokeOtherSessions(userId: string, currentSessionId: string): Promise<void> {
    await this.database
      .getRepository(SessionEntity)
      .createQueryBuilder()
      .update()
      .set({ revokedAt: new Date() })
      .where('user_id = :userId', { userId })
      .andWhere('id <> :currentSessionId', { currentSessionId })
      .andWhere('revoked_at IS NULL')
      .execute();
  }

  private async issueSession(
    user: UserEntity,
    request: { userAgent?: string; ip?: string },
    revokeSessionId?: string,
  ): Promise<SessionIssue> {
    const token = randomBytes(32).toString('base64url');
    const csrfToken = randomBytes(24).toString('base64url');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const result = await this.database.transaction('SERIALIZABLE', async (manager) => {
      await manager.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [user.id]);
      const sessionRepository = manager.getRepository(SessionEntity);
      if (revokeSessionId) {
        await sessionRepository.update(
          { id: revokeSessionId, userId: user.id, revokedAt: IsNull() },
          { revokedAt: now },
        );
      }
      const active = await sessionRepository
        .createQueryBuilder('session')
        .where('session.userId = :userId', { userId: user.id })
        .andWhere('session.revokedAt IS NULL')
        .andWhere('session.expiresAt > now()')
        .orderBy('session.lastSeenAt', 'DESC')
        .getMany();
      const limit = await this.sessionLimit(user.id, manager);
      if (active.length >= limit) {
        return { session: null, limit, active };
      }
      const session = await sessionRepository.save(
        sessionRepository.create({
          id: randomUUID(),
          userId: user.id,
          tokenHash: this.tokenHash(token),
          userAgent: request.userAgent?.slice(0, 512) ?? null,
          ipAddress: request.ip?.slice(0, 64) ?? null,
          expiresAt,
          lastSeenAt: now,
          createdAt: now,
          revokedAt: null,
        }),
      );
      return { session, limit, active };
    });
    if (!result.session) {
      throw new ConflictException({
        message: `Limite dispositivi raggiunto: revoca una sessione per accedere`,
        code: 'SESSION_LIMIT_REACHED',
        limit: result.limit,
        sessions: result.active.map((item) => ({
          id: item.id,
          userAgent: item.userAgent,
          ipAddress: item.ipAddress,
          createdAt: item.createdAt,
          lastSeenAt: item.lastSeenAt,
        })),
      });
    }
    const session = result.session;
    return {
      token,
      csrfToken,
      expiresAt,
      principal: {
        userId: user.id,
        sessionId: session.id,
        email: user.email,
        displayName: user.displayName,
      },
    };
  }

  private async sessionLimit(
    userId: string,
    manager: import('typeorm').EntityManager,
  ): Promise<number> {
    const [result] = await manager.query<Array<{ unlimited: boolean }>>(
      `SELECT EXISTS (
         SELECT 1 FROM workspace_memberships membership
         JOIN workspaces workspace ON workspace.id = membership.workspace_id
         WHERE membership.user_id = $1 AND membership.status = 'active'
           AND workspace.status = 'active' AND workspace.plan = 'unlimited'
       ) AS unlimited`,
      [userId],
    );
    return result?.unlimited ? 2 : 1;
  }

  private async sendToken(
    user: UserEntity,
    purpose: AuthTokenEntity['purpose'],
    ttlMs: number,
  ): Promise<void> {
    const token = randomBytes(32).toString('base64url');
    const now = new Date();
    await this.authTokens.save(
      this.authTokens.create({
        id: randomUUID(),
        userId: user.id,
        purpose,
        tokenHash: this.tokenHash(token),
        createdAt: now,
        expiresAt: new Date(now.getTime() + ttlMs),
        consumedAt: null,
      }),
    );
    await this.email.send({
      idempotencyKey: `${purpose}:${user.id}:${this.tokenHash(token).slice(0, 12)}`,
      to: user.email,
      template: purpose,
      locale: 'it',
      variables: { displayName: user.displayName, token },
    });
  }

  private async consumeToken<T>(
    token: string,
    purpose: AuthTokenEntity['purpose'],
    action: (token: AuthTokenEntity, manager: import('typeorm').EntityManager) => Promise<T>,
  ): Promise<T> {
    return this.database.transaction('SERIALIZABLE', async (manager) => {
      const repository = manager.getRepository(AuthTokenEntity);
      const entity = await repository
        .createQueryBuilder('token')
        .addSelect('token.tokenHash')
        .setLock('pessimistic_write')
        .where('token.tokenHash = :hash', { hash: this.tokenHash(token) })
        .andWhere('token.purpose = :purpose', { purpose })
        .andWhere('token.consumedAt IS NULL')
        .andWhere('token.expiresAt > now()')
        .getOne();
      if (!entity) throw new BadRequestException('Token non valido o scaduto');
      const result = await action(entity, manager);
      entity.consumedAt = new Date();
      await repository.save(entity);
      return result;
    });
  }

  private hashPassword(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 19_456,
      timeCost: 3,
      parallelism: 1,
    });
  }

  private tokenHash(token: string): string {
    return createHmac('sha256', this.config.sessionPepper).update(token).digest('hex');
  }

  private async uniqueSlug(
    name: string,
    manager: import('typeorm').EntityManager,
  ): Promise<string> {
    const base =
      name
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 60) || 'workspace';
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const slug = attempt === 0 ? base : `${base}-${randomBytes(3).toString('hex')}`;
      const count = await manager.getRepository(WorkspaceEntity).countBy({ slug });
      if (count === 0) return slug;
    }
    return `${base}-${randomUUID().slice(0, 8)}`;
  }
}
