import { Result } from 'domain/shared/core';
import { UserId } from 'domain/shared/ids';
import { IUserRepository } from 'domain/identity/repository/IUserRepository';
import { TokenPayload } from '../interfaces/ITokenService';

export const INVALID_SESSION = 'Invalid token';

export interface AuthenticatedUser {
  userId: string;
  email: string;
  role: string;
}

// Runs on every authenticated request. A signature only proves the token was
// issued; this checks the account still stands behind it — it exists, is not
// disabled, and nothing has ended its sessions since (IDN-065). The role and
// email come from the account, not the token, so a role change applies at
// once.
export class SessionValidator {
  constructor(private readonly userRepository: IUserRepository) {}

  public async validate(
    payload: TokenPayload
  ): Promise<Result<AuthenticatedUser>> {
    const id = UserId.parse(payload.userId);
    if (id.isFailure) return Result.fail(INVALID_SESSION);

    const found = await this.userRepository.findById(id.value);
    if (found.isFailure) {
      return Result.fail(`Failed to check session: ${found.error}`);
    }

    const user = found.value;
    if (
      !user ||
      user.isDisabled ||
      user.tokenVersion !== payload.tokenVersion
    ) {
      return Result.fail(INVALID_SESSION);
    }

    return Result.ok({
      userId: user.id.toString(),
      email: user.email.toString(),
      role: user.role.toString()
    });
  }
}
