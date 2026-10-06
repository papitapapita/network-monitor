import { Result } from 'domain/shared/core';
import { IUserRepository } from 'domain/identity/repository/IUserRepository';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import {
  StartTwoFactorSetupRequestDTO,
  StartTwoFactorSetupResponseDTO
} from '../dtos/TwoFactorDTOs';
import { ISecretCipher } from '../interfaces/ISecretCipher';
import { ITwoFactorCodes } from '../interfaces/ITwoFactorCodes';
import {
  SignInSteps,
  withoutSignInSecrets
} from '../services/SignInSteps';

// The name the authenticator app shows above the code.
export const TWO_FACTOR_ISSUER = 'Mi Red Control';

// IDN-168: a new secret for the app, kept encrypted until a code proves it.
export class StartTwoFactorSetupUseCase extends UseCase<
  StartTwoFactorSetupRequestDTO,
  StartTwoFactorSetupResponseDTO
> {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly signInSteps: SignInSteps,
    private readonly twoFactorCodes: ITwoFactorCodes,
    private readonly secretCipher: ISecretCipher,
    logger: ILogger
  ) {
    super(logger, 'StartTwoFactorSetupUseCase');
  }

  protected sanitizeForLogging(data: unknown): unknown {
    return withoutSignInSecrets(data);
  }

  protected async executeImpl(
    request: StartTwoFactorSetupRequestDTO
  ): Promise<Result<StartTwoFactorSetupResponseDTO>> {
    const opened = await this.signInSteps.open(
      request.challengeToken,
      'two-factor-setup'
    );
    if (opened.isFailure) return this.fail(opened.error);
    const user = opened.value;

    const secret = this.twoFactorCodes.generateSecret();
    const started = user.startTwoFactorSetup(
      this.secretCipher.encrypt(secret)
    );
    if (started.isFailure) return this.fail(started.error);

    const saved = await this.userRepository.save(user);
    if (saved.isFailure) {
      return this.fail(`Failed to save setup: ${saved.error}`);
    }

    return this.ok({
      secret,
      otpauthUri: this.twoFactorCodes.provisioningUri(
        secret,
        user.email.toString(),
        TWO_FACTOR_ISSUER
      )
    });
  }
}
