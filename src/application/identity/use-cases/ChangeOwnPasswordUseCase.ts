import { Result } from 'domain/shared/core';
import { UserId } from 'domain/shared/ids';
import { IUserRepository } from 'domain/identity/repository/IUserRepository';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import {
  ChangeOwnPasswordRequestDTO,
  ChangeOwnPasswordResponseDTO
} from '../dtos/UserManagementDTOs';
import { IPasswordService } from '../interfaces/IPasswordService';
import { ITokenService } from '../interfaces/ITokenService';
import { VENDOR_PASSWORD_MIN_LENGTH } from './EnsureVendorAccountUseCase';
import {
  checkPassword,
  withoutPasswords
} from '../services/userAccountPolicy';

export const WRONG_CURRENT_PASSWORD = 'Current password is incorrect';

// Any role, the vendor included. Changing it ends every session of the
// account, this one too, so the caller gets a fresh token back.
export class ChangeOwnPasswordUseCase extends UseCase<
  ChangeOwnPasswordRequestDTO,
  ChangeOwnPasswordResponseDTO
> {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly passwordService: IPasswordService,
    private readonly tokenService: ITokenService,
    logger: ILogger
  ) {
    super(logger, 'ChangeOwnPasswordUseCase');
  }

  protected sanitizeForLogging(data: unknown): unknown {
    if (data && typeof data === 'object' && 'token' in data)
      return {};
    return withoutPasswords(data);
  }

  protected async executeImpl(
    request: ChangeOwnPasswordRequestDTO
  ): Promise<Result<ChangeOwnPasswordResponseDTO>> {
    const id = UserId.parse(request.userId);
    if (id.isFailure)
      return this.fail(`Invalid user ID: ${request.userId}`);

    const found = await this.userRepository.findById(id.value);
    if (found.isFailure) {
      return this.fail(`Failed to look up user: ${found.error}`);
    }
    const user = found.value;
    if (!user) return this.fail(`User not found: ${request.userId}`);

    const matches = await this.passwordService.compare(
      request.currentPassword,
      user.passwordHash
    );
    if (!matches) return this.fail(WRONG_CURRENT_PASSWORD);

    // The vendor account keeps the length it was created with (IDN-012).
    const weak = checkPassword(
      request.newPassword,
      user.role.isVendor() ? VENDOR_PASSWORD_MIN_LENGTH : undefined
    );
    if (weak) return this.fail(weak);

    const changed = user.changePassword(
      await this.passwordService.hash(request.newPassword)
    );
    if (changed.isFailure) return this.fail(changed.error!);

    const saved = await this.userRepository.save(user);
    if (saved.isFailure) return this.fail(saved.error!);

    return this.ok({
      token: this.tokenService.sign({
        userId: user.id.toString(),
        email: user.email.toString(),
        role: user.role.toString(),
        tokenVersion: user.tokenVersion
      })
    });
  }
}
