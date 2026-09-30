import { Result } from 'domain/shared/core';
import { UserId } from 'domain/shared/ids';
import { User } from 'domain/identity';
import { IUserRepository } from 'domain/identity/repository/IUserRepository';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import {
  UpdateUserRequestDTO,
  UserAccountDTO
} from '../dtos/UserManagementDTOs';
import { IPasswordService } from '../interfaces/IPasswordService';
import { UserMapper } from '../mappers/UserMapper';
import {
  assignableRole,
  checkPassword,
  isVendorAccount,
  OWN_ACCOUNT_REFUSED,
  VENDOR_ACCOUNT_PROTECTED,
  withoutPasswords
} from '../services/userAccountPolicy';

// Role, status and password of another user. Each of them ends the user's
// open sessions (IDN-065), except re-enabling, which has none to end.
export class UpdateUserUseCase extends UseCase<
  UpdateUserRequestDTO,
  UserAccountDTO
> {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly passwordService: IPasswordService,
    logger: ILogger
  ) {
    super(logger, 'UpdateUserUseCase');
  }

  protected sanitizeForLogging(data: unknown): unknown {
    return withoutPasswords(data);
  }

  protected async executeImpl(
    request: UpdateUserRequestDTO
  ): Promise<Result<UserAccountDTO>> {
    const id = UserId.parse(request.id);
    if (id.isFailure)
      return this.fail(`Invalid user ID: ${request.id}`);

    if (
      request.role === undefined &&
      request.disabled === undefined &&
      request.password === undefined
    ) {
      return this.fail('Nothing to update');
    }

    const found = await this.userRepository.findById(id.value);
    if (found.isFailure) {
      return this.fail(`Failed to look up user: ${found.error}`);
    }
    const user = found.value;
    if (!user) return this.fail(`User not found: ${request.id}`);

    if (isVendorAccount(user))
      return this.fail(VENDOR_ACCOUNT_PROTECTED);
    if (user.id.toString() === request.callerId) {
      return this.fail(OWN_ACCOUNT_REFUSED);
    }

    const applied = await this.apply(user, request);
    if (applied.isFailure) return this.fail(applied.error!);

    const saved = await this.userRepository.save(user);
    if (saved.isFailure) return this.fail(saved.error!);

    return this.ok(UserMapper.toAccountDTO(user));
  }

  private async apply(
    user: User,
    request: UpdateUserRequestDTO
  ): Promise<Result<void>> {
    if (request.role !== undefined) {
      const role = assignableRole(request.role);
      if (role.isFailure) return Result.fail(role.error!);
      if (!role.value.equals(user.role)) {
        const changed = user.changeRole(role.value);
        if (changed.isFailure) return changed;
      }
    }

    if (
      request.disabled !== undefined &&
      request.disabled !== user.isDisabled
    ) {
      const changed = request.disabled
        ? user.disable()
        : user.enable();
      if (changed.isFailure) return changed;
    }

    if (request.password !== undefined) {
      const weak = checkPassword(request.password);
      if (weak) return Result.fail(weak);
      const changed = user.changePassword(
        await this.passwordService.hash(request.password)
      );
      if (changed.isFailure) return changed;
    }

    return Result.ok();
  }
}
