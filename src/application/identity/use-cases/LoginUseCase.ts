import { Result } from 'domain/shared/core';
import { SIGN_IN_PAUSED, UserEmail } from 'domain/identity';
import { IUserRepository } from 'domain/identity/repository/IUserRepository';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { LoginRequestDTO } from '../dtos/LoginRequestDTO';
import { LoginResponseDTO } from '../dtos/LoginResponseDTO';
import { IPasswordService } from '../interfaces/IPasswordService';
import {
  SignInSteps,
  withoutSignInSecrets
} from '../services/SignInSteps';

export class LoginUseCase extends UseCase<
  LoginRequestDTO,
  LoginResponseDTO
> {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly passwordService: IPasswordService,
    private readonly signInSteps: SignInSteps,
    logger: ILogger
  ) {
    super(logger, 'LoginUseCase');
  }

  protected sanitizeForLogging(data: unknown): unknown {
    return withoutSignInSecrets(data);
  }

  protected async executeImpl(
    request: LoginRequestDTO
  ): Promise<Result<LoginResponseDTO>> {
    const emailResult = UserEmail.create(request.email);
    if (emailResult.isFailure) {
      return this.fail('Invalid credentials');
    }

    const userResult = await this.userRepository.findByEmail(
      emailResult.value
    );
    if (userResult.isFailure) {
      return this.fail(`Failed to look up user: ${userResult.error}`);
    }

    const user = userResult.value;
    if (!user || user.isDisabled) {
      return this.fail('Invalid credentials');
    }

    // Checked before the password, so a pause holds even for the right one
    // (IDN-044).
    if (user.isSignInPaused(new Date())) {
      return this.fail(SIGN_IN_PAUSED);
    }

    const passwordMatch = await this.passwordService.compare(
      request.password,
      user.passwordHash
    );
    if (!passwordMatch) {
      await this.signInSteps.recordFailure(
        user,
        request.sourceIp,
        this.logger
      );
      return this.fail('Invalid credentials');
    }

    if (
      request.trustedBrowserToken !== null &&
      this.signInSteps.remembers(user, request.trustedBrowserToken)
    ) {
      user.recordSuccessfulSignIn();
      const saved = await this.userRepository.save(user);
      if (saved.isFailure) {
        return this.fail(`Failed to save sign-in: ${saved.error}`);
      }
      return this.ok(this.signInSteps.session(user));
    }

    // The count is cleared only once the code is right too, so the password
    // alone cannot reset the code's budget (IDN-044).
    return this.ok(this.signInSteps.challenge(user));
  }
}
