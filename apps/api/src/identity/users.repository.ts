import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { EntityManager, Repository } from 'typeorm';
import { UserEntity } from './entities/user.entity';

@Injectable()
export class UsersRepository {
  constructor(@InjectRepository(UserEntity) private readonly users: Repository<UserEntity>) {}

  findByEmailWithPassword(email: string): Promise<UserEntity | null> {
    return this.users
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('lower(user.email) = lower(:email)', { email })
      .getOne();
  }

  findById(id: string): Promise<UserEntity | null> {
    return this.users.findOneBy({ id });
  }

  save(user: UserEntity, manager?: EntityManager): Promise<UserEntity> {
    return (manager?.getRepository(UserEntity) ?? this.users).save(user);
  }

  create(values: Partial<UserEntity>, manager?: EntityManager): UserEntity {
    return (manager?.getRepository(UserEntity) ?? this.users).create(values);
  }
}
