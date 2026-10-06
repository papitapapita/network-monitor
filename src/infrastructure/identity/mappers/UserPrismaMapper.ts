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
  disabledAt: Date | null;
  tokenVersion: number;
  failedSignIns: number;
  signInPausedUntil: Date | null;
  twoFactorSecret: string | null;
  twoFactorEnabledAt: Date | null;
  twoFactorLastStep: number | null;
  recoveryCodeHashes: string[];
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
        disabledAt: raw.disabledAt,
        tokenVersion: raw.tokenVersion,
        failedSignIns: raw.failedSignIns,
        signInPausedUntil: raw.signInPausedUntil,
        twoFactorSecret: raw.twoFactorSecret,
        twoFactorEnabledAt: raw.twoFactorEnabledAt,
        twoFactorLastStep: raw.twoFactorLastStep,
        recoveryCodeHashes: raw.recoveryCodeHashes,
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
      disabledAt: user.disabledAt,
      tokenVersion: user.tokenVersion,
      failedSignIns: user.failedSignIns,
      signInPausedUntil: user.signInPausedUntil,
      twoFactorSecret: user.twoFactorSecret,
      twoFactorEnabledAt: user.twoFactorEnabledAt,
      twoFactorLastStep: user.twoFactorLastStep,
      recoveryCodeHashes: user.recoveryCodeHashes,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };
  }
}
