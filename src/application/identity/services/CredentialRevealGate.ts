import { Result } from 'domain/shared/core';
import { UserId } from 'domain/shared/ids';
import { IUserRepository } from 'domain/identity/repository/IUserRepository';
import { ITokenService } from '../interfaces/ITokenService';

export const CREDENTIAL_REVEAL_LOCKED =
  'Enter your password to see device credentials';

// The unlock belongs to the one session that asked for it: another user's
// token does not open it, and whatever ends the account's sessions ends the
// unlock too (IDN-065, IDN-086).
export class CredentialRevealGate {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly tokenService: ITokenService
  ) {}

  public async check(
    revealToken: string | null,
    userId: string
  ): Promise<Result<void>> {
    if (!revealToken) return Result.fail(CREDENTIAL_REVEAL_LOCKED);

    const verified = this.tokenService.verifyChallenge(
      revealToken,
      'credential-reveal'
    );
    if (verified.isFailure || verified.value.userId !== userId) {
      return Result.fail(CREDENTIAL_REVEAL_LOCKED);
    }

    const id = UserId.parse(userId);
    if (id.isFailure) return Result.fail(CREDENTIAL_REVEAL_LOCKED);

    const found = await this.userRepository.findById(id.value);
    if (found.isFailure) {
      return Result.fail(`Failed to look up user: ${found.error}`);
    }
    const user = found.value;
    if (
      !user ||
      user.isDisabled ||
      user.tokenVersion !== verified.value.tokenVersion
    ) {
      return Result.fail(CREDENTIAL_REVEAL_LOCKED);
    }
    return Result.ok();
  }
}
