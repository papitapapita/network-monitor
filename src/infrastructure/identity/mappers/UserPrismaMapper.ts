import { Result } from 'domain/shared/core';
import { UserId } from 'domain/shared/ids';
import { User } from 'domain/identity/aggregates/User';
import { UserEmail } from 'domain/identity/value-objects/UserEmail';
import { UserRole } from 'domain/identity/value-objects/UserRole';

interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  role: string;
  createdAt: Date;
  updatedAt: Date;
}

export class UserPrismaMapper {
  public static toDomain(raw: UserRecord): Result<User> {
    const idResult = UserId.parse(raw.id);
    if (idResult.isFailure) {
      return Result.fail<User>(`Invalid user id: ${idResult.error}`);
    }

    return Result.ok<User>(
      User.reconstitute(idResult.value, {
        email: UserEmail.reconstitute(raw.email),
        role: UserRole.reconstitute(raw.role),
        passwordHash: raw.passwordHash,
        createdAt: raw.createdAt,
        updatedAt: raw.updatedAt
      })
    );
  }

  public static toPersistence(user: User): UserRecord {
    return {
      id: user.id.toString(),
      email: user.email.toString(),
      passwordHash: user.passwordHash,
      role: user.role.toString(),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };
  }
}
