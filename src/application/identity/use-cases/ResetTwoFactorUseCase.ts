import { Result } from 'domain/shared/core';
import { UserId } from 'domain/shared/ids';
import { UserRole } from 'domain/identity';
import { IUserRepository } from 'domain/identity/repository/IUserRepository';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import {
  ResetTwoFactorRequestDTO,
  UserAccountDTO
} from '../dtos/UserManagementDTOs';
import { UserMapper } from '../mappers/UserMapper';
import {
  ADMIN_RESET_NEEDS_VENDOR,
  isVendorAccount,
  VENDOR_ACCOUNT_PROTECTED
} from '../services/userAccountPolicy';

// IDN-172: for someone who lost both their phone and their recovery codes.
export class ResetTwoFactorUseCase extends UseCase<
  ResetTwoFactorRequestDTO,
  UserAccountDTO
> {
  constructor(
    private readonly userRepository: IUserRepository,
    logger: ILogger
  ) {
    super(logger, 'ResetTwoFactorUseCase');
  }

  protected async executeImpl(
    request: ResetTwoFactorRequestDTO
  ): Promise<Result<UserAccountDTO>> {
    const id = UserId.parse(request.id);
    if (id.isFailure)
      return this.fail(`Invalid user ID: ${request.id}`);

    const found = await this.userRepository.findById(id.value);
    if (found.isFailure) {
      return this.fail(`Failed to look up user: ${found.error}`);
    }
    const user = found.value;
    if (!user) return this.fail(`User not found: ${request.id}`);

    if (isVendorAccount(user))
      return this.fail(VENDOR_ACCOUNT_PROTECTED);
    // An administrator resetting another, or their own, would let one
    // stolen admin session strip the second factor from every admin.
    if (
      user.role.toString() === UserRole.ADMIN &&
      request.callerRole !== UserRole.VENDOR
    ) {
      return this.fail(ADMIN_RESET_NEEDS_VENDOR);
    }

    const reset = user.resetTwoFactor(
      request.callerEmail,
      new Date()
    );
    if (reset.isFailure) return this.fail(reset.error);

    const saved = await this.userRepository.save(user);
    if (saved.isFailure) return this.fail(saved.error!);

    return this.ok(UserMapper.toAccountDTO(user));
  }
}
