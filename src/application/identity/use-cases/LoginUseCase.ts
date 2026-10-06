import { Result } from 'domain/shared/core';
import { SIGN_IN_PAUSED, User, UserEmail } from 'domain/identity';
import { IUserRepository } from 'domain/identity/repository/IUserRepository';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { LoginRequestDTO } from '../dtos/LoginRequestDTO';
import { LoginResponseDTO } from '../dtos/LoginResponseDTO';
import { IPasswordService } from '../interfaces/IPasswordService';
import { ITokenService } from '../interfaces/ITokenService';
import { UserMapper } from '../mappers/UserMapper';

export class LoginUseCase extends UseCase<
  LoginRequestDTO,
  LoginResponseDTO
> {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly passwordService: IPasswordService,
    private readonly tokenService: ITokenService,
    logger: ILogger
  ) {
    super(logger, 'LoginUseCase');
  }

  protected sanitizeForLogging(data: unknown): unknown {
    if (data && typeof data === 'object' && 'password' in data) {
      const { password: _omit, ...safe } = data as Record<
        string,
        unknown
      >;
      return safe;
    }
    return data;
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
    const now = new Date();
    if (user.isSignInPaused(now)) {
      return this.fail(SIGN_IN_PAUSED);
    }

    const passwordMatch = await this.passwordService.compare(
      request.password,
      user.passwordHash
    );
    if (!passwordMatch) {
      await this.record(
        user,
        user.recordFailedSignIn(now, request.sourceIp)
      );
      return this.fail('Invalid credentials');
    }

    if (user.failedSignIns > 0) {
      await this.record(user, user.recordSuccessfulSignIn());
    }

    const token = this.tokenService.sign({
      userId: user.id.toString(),
      email: user.email.toString(),
      role: user.role.toString(),
      tokenVersion: user.tokenVersion
    });

    return this.ok({ token, user: UserMapper.toDTO(user) });
  }

  // A counter that fails to save must not change the sign-in's answer: the
  // caller still gets the outcome its password earned.
  private async record(
    user: User,
    change: Result<void>
  ): Promise<void> {
    if (change.isFailure) return;
    const saved = await this.userRepository.save(user);
    if (saved.isFailure) {
      this.logger.error(
        'LoginUseCase: sign-in counter not saved',
        undefined,
        {
          userId: user.id.toString(),
          error: saved.error
        }
      );
    }
  }
}
