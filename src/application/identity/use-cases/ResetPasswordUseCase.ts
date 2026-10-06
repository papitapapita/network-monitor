import { Result } from 'domain/shared/core';
import { UserId } from 'domain/shared/ids';
import { IUserRepository } from 'domain/identity/repository/IUserRepository';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { ResetPasswordRequestDTO } from '../dtos/PasswordResetDTOs';
import { IPasswordService } from '../interfaces/IPasswordService';
import { ITokenService } from '../interfaces/ITokenService';
import { withoutSignInSecrets } from '../services/SignInSteps';
import { checkPassword } from '../services/userAccountPolicy';
import { VENDOR_PASSWORD_MIN_LENGTH } from './EnsureVendorAccountUseCase';

export const RESET_LINK_EXPIRED =
  'Reset link expired or already used';

// IDN-183. The link is bound to the token version, and the new password
// moves it on, so a link works once and ends every session.
export class ResetPasswordUseCase extends UseCase<
  ResetPasswordRequestDTO,
  void
> {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly passwordService: IPasswordService,
    private readonly tokenService: ITokenService,
    logger: ILogger
  ) {
    super(logger, 'ResetPasswordUseCase');
  }

  protected sanitizeForLogging(data: unknown): unknown {
    return withoutSignInSecrets(data);
  }

  protected async executeImpl(
    request: ResetPasswordRequestDTO
  ): Promise<Result<void>> {
    const verified = this.tokenService.verifyChallenge(
      request.token,
      'password-reset'
    );
    if (verified.isFailure) return this.fail(RESET_LINK_EXPIRED);

    const id = UserId.parse(verified.value.userId);
    if (id.isFailure) return this.fail(RESET_LINK_EXPIRED);

    const found = await this.userRepository.findById(id.value);
    if (found.isFailure) {
      return this.fail(`Failed to look up user: ${found.error}`);
    }
    const user = found.value;
    if (
      !user ||
      user.isDisabled ||
      user.tokenVersion !== verified.value.tokenVersion
    ) {
      return this.fail(RESET_LINK_EXPIRED);
    }

    // The vendor account keeps the length it was created with (IDN-012).
    const weak = checkPassword(
      request.password,
      user.role.isVendor() ? VENDOR_PASSWORD_MIN_LENGTH : undefined
    );
    if (weak) return this.fail(weak);

    const changed = user.changePassword(
      await this.passwordService.hash(request.password)
    );
    if (changed.isFailure) return this.fail(changed.error!);

    const saved = await this.userRepository.save(user);
    if (saved.isFailure) return this.fail(saved.error!);

    return this.ok(undefined);
  }
}
