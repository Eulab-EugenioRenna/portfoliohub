import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Inject, Injectable, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { hash, verify } from 'argon2';
import { IsNull, MoreThan, type Repository } from 'typeorm';
import { integrationsConfig } from '../config/integrations.config';
import type { StaffPrincipal } from './admin.types';
import type { StaffLoginDto } from './dto/admin.dto';
import { StaffSessionEntity } from './entities/staff-session.entity';
import { StaffUserEntity } from './entities/staff-user.entity';

@Injectable()
export class StaffAuthService implements OnModuleInit {
  constructor(
    @InjectRepository(StaffUserEntity) private readonly staff: Repository<StaffUserEntity>,
    @InjectRepository(StaffSessionEntity) private readonly sessions: Repository<StaffSessionEntity>,
    @Inject(integrationsConfig.KEY) private readonly config: ConfigType<typeof integrationsConfig>,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.config.adminEmail || !this.config.adminPassword) return;
    const email = this.config.adminEmail.toLowerCase();
    if (await this.staff.existsBy({ email })) return;
    await this.staff.save(
      this.staff.create({
        id: randomUUID(),
        email,
        displayName: 'Amministratore',
        passwordHash: await hash(this.config.adminPassword),
        role: 'admin',
        status: 'active',
        createdAt: new Date(),
        lastLoginAt: null,
      }),
    );
  }

  async login(
    dto: StaffLoginDto,
    metadata: { ip?: string; userAgent?: string },
  ): Promise<{ token: string; csrfToken: string; expiresAt: Date; principal: StaffPrincipal }> {
    const staff = await this.staff
      .createQueryBuilder('staff')
      .addSelect('staff.passwordHash')
      .where('lower(staff.email) = lower(:email)', { email: dto.email })
      .getOne();
    if (!staff || staff.status !== 'active' || !(await verify(staff.passwordHash, dto.password)))
      throw new UnauthorizedException('Credenziali non valide');
    const token = randomBytes(32).toString('base64url');
    const csrfToken = randomBytes(24).toString('base64url');
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);
    const session = await this.sessions.save(
      this.sessions.create({
        id: randomUUID(),
        staffUserId: staff.id,
        tokenHash: this.digest(token),
        csrfToken,
        ipAddress: metadata.ip ?? null,
        userAgent: metadata.userAgent?.slice(0, 500) ?? null,
        expiresAt,
        revokedAt: null,
        createdAt: new Date(),
      }),
    );
    await this.staff.update(staff.id, { lastLoginAt: new Date() });
    return {
      token,
      csrfToken,
      expiresAt,
      principal: {
        staffUserId: staff.id,
        sessionId: session.id,
        email: staff.email,
        displayName: staff.displayName,
        role: staff.role,
      },
    };
  }

  async authenticate(token: string): Promise<StaffPrincipal> {
    const session = await this.sessions.findOneBy({
      tokenHash: this.digest(token),
      revokedAt: IsNull(),
      expiresAt: MoreThan(new Date()),
    });
    if (!session) throw new UnauthorizedException('Sessione staff non valida');
    const staff = await this.staff.findOneBy({ id: session.staffUserId, status: 'active' });
    if (!staff) throw new UnauthorizedException('Account staff non disponibile');
    return {
      staffUserId: staff.id,
      sessionId: session.id,
      email: staff.email,
      displayName: staff.displayName,
      role: staff.role,
    };
  }

  async logout(sessionId: string): Promise<void> {
    await this.sessions.update(sessionId, { revokedAt: new Date() });
  }
  private digest(token: string): string {
    return createHash('sha256').update(`${token}:${this.config.sessionPepper}:staff`).digest('hex');
  }
}
