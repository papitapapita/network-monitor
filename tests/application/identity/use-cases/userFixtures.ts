import { IUserRepository } from '../../../../src/domain/identity/repository/IUserRepository';
import { IPasswordService } from '../../../../src/application/identity/interfaces/IPasswordService';
import { Result } from '../../../../src/domain/shared/core/Result';
import { User } from '../../../../src/domain/identity/aggregates/User';
import { UserEmail } from '../../../../src/domain/identity/value-objects/UserEmail';
import { UserRole } from '../../../../src/domain/identity/value-objects/UserRole';
import { UserId } from '../../../../src/domain/shared/ids/UserId';

export function makeUser(
  role = 'OPERATOR',
  email = 'staff@isp.example'
): User {
  const now = new Date('2024-01-01T00:00:00.000Z');
  return User.reconstitute(UserId.create(), {
    email: UserEmail.reconstitute(email),
    role: UserRole.reconstitute(role),
    passwordHash: '$2b$10$existing',
    disabledAt: null,
    tokenVersion: 0,
    createdAt: now,
    updatedAt: now
  });
}

export function makeUserRepo(
  users: User[] = []
): jest.Mocked<IUserRepository> {
  return {
    save: jest.fn(async (u: User) => Result.ok<User>(u)),
    findById: jest.fn(async (id: UserId) =>
      Result.ok<User | null>(
        users.find((u) => u.id.equals(id)) ?? null
      )
    ),
    findByEmail: jest.fn(),
    findAll: jest.fn().mockResolvedValue(Result.ok<User[]>(users))
  };
}

export function makePasswordService(): jest.Mocked<IPasswordService> {
  return {
    hash: jest.fn(async (plain: string) => `hashed:${plain}`),
    compare: jest.fn(
      async (plain: string, hash: string) =>
        hash === `hashed:${plain}` ||
        (hash === '$2b$10$existing' && plain === 'current-pass')
    )
  };
}
