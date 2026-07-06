import { Result } from 'domain/shared/core';
import { UserId } from 'domain/shared/ids';
import { User } from '../aggregates/User';
import { UserEmail } from '../value-objects/UserEmail';

export interface IUserRepository {
  save(user: User): Promise<Result<User>>;
  findById(id: UserId): Promise<Result<User | null>>;
  findByEmail(email: UserEmail): Promise<Result<User | null>>;
}
