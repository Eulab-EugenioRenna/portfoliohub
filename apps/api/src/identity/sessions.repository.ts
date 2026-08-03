import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { SessionEntity } from './entities/session.entity';

@Injectable()
export class SessionsRepository {
  constructor(
    @InjectRepository(SessionEntity) private readonly sessions: Repository<SessionEntity>,
  ) {}

  findActiveByTokenHash(tokenHash: string): Promise<SessionEntity | null> {
    return this.sessions
      .createQueryBuilder('session')
      .addSelect('session.tokenHash')
      .where('session.tokenHash = :tokenHash', { tokenHash })
      .andWhere('session.revokedAt IS NULL')
      .andWhere('session.expiresAt > now()')
      .getOne();
  }

  save(session: SessionEntity): Promise<SessionEntity> {
    return this.sessions.save(session);
  }

  create(values: Partial<SessionEntity>): SessionEntity {
    return this.sessions.create(values);
  }

  async revoke(id: string, userId: string): Promise<void> {
    await this.sessions.update({ id, userId }, { revokedAt: new Date() });
  }

  listForUser(userId: string): Promise<SessionEntity[]> {
    return this.sessions
      .createQueryBuilder('session')
      .where('session.userId = :userId', { userId })
      .andWhere('session.revokedAt IS NULL')
      .andWhere('session.expiresAt > now()')
      .orderBy('session.lastSeenAt', 'DESC')
      .getMany();
  }
}
