import { createHash, randomUUID } from 'node:crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { PolicyAcceptanceEntity } from './entities/policy-acceptance.entity';
import { PolicyVersionEntity } from './entities/policy-version.entity';

@Injectable()
export class PoliciesService {
  constructor(
    @InjectRepository(PolicyVersionEntity)
    private readonly versions: Repository<PolicyVersionEntity>,
    @InjectRepository(PolicyAcceptanceEntity)
    private readonly acceptances: Repository<PolicyAcceptanceEntity>,
  ) {}

  latest(kind: string, locale: string): Promise<PolicyVersionEntity | null> {
    return this.versions.findOne({ where: { kind, locale }, order: { effectiveAt: 'DESC' } });
  }

  async publish(input: {
    kind: string;
    locale: string;
    version: string;
    content: Record<string, unknown>;
    material: boolean;
    effectiveAt: Date;
  }): Promise<PolicyVersionEntity> {
    const canonical = JSON.stringify(input.content);
    return this.versions.save(
      this.versions.create({
        id: randomUUID(),
        ...input,
        contentHash: createHash('sha256').update(canonical).digest('hex'),
        publishedAt: new Date(),
      }),
    );
  }

  async pending(userId: string, locale: string): Promise<PolicyVersionEntity[]> {
    return this.versions
      .createQueryBuilder('policy')
      .leftJoin(
        PolicyAcceptanceEntity,
        'acceptance',
        'acceptance.policyVersionId = policy.id AND acceptance.userId = :userId',
        { userId },
      )
      .where('policy.locale = :locale', { locale })
      .andWhere('policy.material = true')
      .andWhere('policy.effectiveAt <= now()')
      .andWhere('acceptance.id IS NULL')
      .orderBy('policy.effectiveAt', 'ASC')
      .getMany();
  }

  async accept(userId: string, policyVersionId: string, ipAddress?: string): Promise<void> {
    const policy = await this.versions.findOneBy({ id: policyVersionId });
    if (!policy) throw new NotFoundException('Versione policy non trovata');
    await this.acceptances
      .createQueryBuilder()
      .insert()
      .values({
        id: randomUUID(),
        userId,
        policyVersionId,
        acceptedAt: new Date(),
        ipAddress: ipAddress ?? null,
      })
      .orIgnore()
      .execute();
  }
}
