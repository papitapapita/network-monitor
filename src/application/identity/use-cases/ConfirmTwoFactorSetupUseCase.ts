import { Result } from 'domain/shared/core';
import {
  SIGN_IN_PAUSED,
  TWO_FACTOR_ALREADY_ON,
  TWO_FACTOR_NOT_STARTED
} from 'domain/identity';
import { IUserRepository } from 'domain/identity/repository/IUserRepository';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import {
  ConfirmTwoFactorSetupRequestDTO,
  ConfirmTwoFactorSetupResponseDTO
} from '../dtos/TwoFactorDTOs';
import { IRecoveryCodes } from '../interfaces/IRecoveryCodes';
import { ISecretCipher } from '../interfaces/ISecretCipher';
import { ITwoFactorCodes } from '../interfaces/ITwoFactorCodes';
import {
  INVALID_CODE,
  SignInSteps,
  withoutSignInSecrets
} from '../services/SignInSteps';

// IDN-169: the first code from the app turns two-factor on and signs in.
export class ConfirmTwoFactorSetupUseCase extends UseCase<
  ConfirmTwoFactorSetupRequestDTO,
  ConfirmTwoFactorSetupResponseDTO
> {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly signInSteps: SignInSteps,
    private readonly twoFactorCodes: ITwoFactorCodes,
    private readonly recoveryCodes: IRecoveryCodes,
    private readonly secretCipher: ISecretCipher,
    logger: ILogger
  ) {
    super(logger, 'ConfirmTwoFactorSetupUseCase');
  }

  protected sanitizeForLogging(data: unknown): unknown {
    return withoutSignInSecrets(data);
  }

  protected async executeImpl(
    request: ConfirmTwoFactorSetupRequestDTO
  ): Promise<Result<ConfirmTwoFactorSetupResponseDTO>> {
    const opened = await this.signInSteps.open(
      request.challengeToken,
      'two-factor-setup'
    );
    if (opened.isFailure) return this.fail(opened.error);
    const user = opened.value;

    const now = new Date();
    if (user.isSignInPaused(now)) return this.fail(SIGN_IN_PAUSED);

    if (user.hasTwoFactor) return this.fail(TWO_FACTOR_ALREADY_ON);
    const encrypted = user.twoFactorSecret;
    if (encrypted === null) return this.fail(TWO_FACTOR_NOT_STARTED);

    const step = this.twoFactorCodes.matchStep(
      this.secretCipher.decrypt(encrypted),
      request.code,
      now
    );
    if (step === null) {
      await this.signInSteps.recordFailure(
        user,
        request.sourceIp,
        this.logger
      );
      return this.fail(INVALID_CODE);
    }

    const { codes, hashes } = this.recoveryCodes.generate();
    const confirmed = user.confirmTwoFactor(step, hashes, now);
    if (confirmed.isFailure) return this.fail(confirmed.error);
    user.recordSuccessfulSignIn();

    const saved = await this.userRepository.save(user);
    if (saved.isFailure) {
      return this.fail(`Failed to save two-factor: ${saved.error}`);
    }

    return this.ok({
      ...this.signInSteps.session(user, request.rememberBrowser),
      recoveryCodes: codes
    });
  }
}
