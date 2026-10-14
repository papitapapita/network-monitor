import { Result } from 'domain/shared/core';
import { UserId } from 'domain/shared/ids';
import { SIGN_IN_PAUSED } from 'domain/identity';
import { IUserRepository } from 'domain/identity/repository/IUserRepository';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import {
  UnlockCredentialRevealRequestDTO,
  UnlockCredentialRevealResponseDTO
} from '../dtos/CredentialRevealDTOs';
import { IPasswordService } from '../interfaces/IPasswordService';
import {
  CREDENTIAL_REVEAL_SECONDS,
  ITokenService
} from '../interfaces/ITokenService';
import {
  SignInSteps,
  withoutSignInSecrets
} from '../services/SignInSteps';

export const WRONG_PASSWORD = 'Password is incorrect';

// A signed-in user types their password again before device secrets are
// shown; the answer opens them for five minutes (IDN-086).
export class UnlockCredentialRevealUseCase extends UseCase<
  UnlockCredentialRevealRequestDTO,
  UnlockCredentialRevealResponseDTO
> {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly passwordService: IPasswordService,
    private readonly tokenService: ITokenService,
    private readonly signInSteps: SignInSteps,
    logger: ILogger
  ) {
    super(logger, 'UnlockCredentialRevealUseCase');
  }

  protected sanitizeForLogging(data: unknown): unknown {
    return withoutSignInSecrets(data);
  }

  protected async executeImpl(
    request: UnlockCredentialRevealRequestDTO
  ): Promise<Result<UnlockCredentialRevealResponseDTO>> {
    const id = UserId.parse(request.userId);
    if (id.isFailure)
      return this.fail(`Invalid user ID: ${request.userId}`);

    const found = await this.userRepository.findById(id.value);
    if (found.isFailure) {
      return this.fail(`Failed to look up user: ${found.error}`);
    }
    const user = found.value;
    if (!user || user.isDisabled) {
      return this.fail(`User not found: ${request.userId}`);
    }

    // A wrong password here is a guess like one at sign-in, so it shares the
    // account's pause (IDN-044).
    if (user.isSignInPaused(new Date())) {
      return this.fail(SIGN_IN_PAUSED);
    }

    const matches = await this.passwordService.compare(
      request.password,
      user.passwordHash
    );
    if (!matches) {
      await this.signInSteps.recordFailure(
        user,
        request.sourceIp,
        this.logger
      );
      return this.fail(WRONG_PASSWORD);
    }

    return this.ok({
      revealToken: this.tokenService.signChallenge({
        userId: user.id.toString(),
        tokenVersion: user.tokenVersion,
        kind: 'credential-reveal'
      }),
      expiresInSeconds: CREDENTIAL_REVEAL_SECONDS
    });
  }
}
