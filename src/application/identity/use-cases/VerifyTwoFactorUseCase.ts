import { Result } from 'domain/shared/core';
import { SIGN_IN_PAUSED } from 'domain/identity';
import { IUserRepository } from 'domain/identity/repository/IUserRepository';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import {
  SessionResponseDTO,
  VerifyTwoFactorRequestDTO
} from '../dtos/TwoFactorDTOs';
import { IRecoveryCodes } from '../interfaces/IRecoveryCodes';
import { ISecretCipher } from '../interfaces/ISecretCipher';
import { ITwoFactorCodes } from '../interfaces/ITwoFactorCodes';
import {
  INVALID_CODE,
  SignInSteps,
  withoutSignInSecrets
} from '../services/SignInSteps';

// IDN-170: a code from the app, or one recovery code, finishes the sign-in.
export class VerifyTwoFactorUseCase extends UseCase<
  VerifyTwoFactorRequestDTO,
  SessionResponseDTO
> {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly signInSteps: SignInSteps,
    private readonly twoFactorCodes: ITwoFactorCodes,
    private readonly recoveryCodes: IRecoveryCodes,
    private readonly secretCipher: ISecretCipher,
    logger: ILogger
  ) {
    super(logger, 'VerifyTwoFactorUseCase');
  }

  protected sanitizeForLogging(data: unknown): unknown {
    return withoutSignInSecrets(data);
  }

  protected async executeImpl(
    request: VerifyTwoFactorRequestDTO
  ): Promise<Result<SessionResponseDTO>> {
    const opened = await this.signInSteps.open(
      request.challengeToken,
      'two-factor'
    );
    if (opened.isFailure) return this.fail(opened.error);
    const user = opened.value;

    const now = new Date();
    if (user.isSignInPaused(now)) return this.fail(SIGN_IN_PAUSED);

    let accepted: Result<void>;
    if (request.recoveryCode !== null) {
      accepted = user.useRecoveryCode(
        this.recoveryCodes.hash(request.recoveryCode)
      );
    } else {
      const step = this.twoFactorCodes.matchStep(
        this.secretCipher.decrypt(user.twoFactorSecret!),
        request.code ?? '',
        now
      );
      // A code already used counts as wrong: whoever replays it saw it
      // (IDN-164).
      accepted =
        step === null
          ? Result.fail<void>(INVALID_CODE)
          : user.acceptTwoFactorCode(step);
    }

    if (accepted.isFailure) {
      await this.signInSteps.recordFailure(
        user,
        request.sourceIp,
        this.logger
      );
      return this.fail(INVALID_CODE);
    }

    user.recordSuccessfulSignIn();
    // Unsaved, the code could be used again, so the sign-in fails with it.
    const saved = await this.userRepository.save(user);
    if (saved.isFailure) {
      return this.fail(`Failed to save sign-in: ${saved.error}`);
    }

    return this.ok(
      this.signInSteps.session(user, request.rememberBrowser)
    );
  }
}
