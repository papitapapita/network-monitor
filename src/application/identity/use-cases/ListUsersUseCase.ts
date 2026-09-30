import { Result } from 'domain/shared/core';
import { UserRole } from 'domain/identity';
import { IUserRepository } from 'domain/identity/repository/IUserRepository';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import {
  ListUsersRequestDTO,
  ListUsersResponseDTO
} from '../dtos/UserManagementDTOs';
import { UserMapper } from '../mappers/UserMapper';

// The customer's staff, oldest first. The vendor account is not part of the
// customer's staff, so only a VENDOR caller sees it (IDN-140).
export class ListUsersUseCase extends UseCase<
  ListUsersRequestDTO,
  ListUsersResponseDTO
> {
  constructor(
    private readonly userRepository: IUserRepository,
    logger: ILogger
  ) {
    super(logger, 'ListUsersUseCase');
  }

  protected async executeImpl(
    request: ListUsersRequestDTO
  ): Promise<Result<ListUsersResponseDTO>> {
    const all = await this.userRepository.findAll();
    if (all.isFailure) {
      return this.fail(`Failed to list users: ${all.error}`);
    }

    const callerIsVendor = request.callerRole === UserRole.VENDOR;
    const users = all.value
      .filter((u) => callerIsVendor || !u.role.isVendor())
      .map(UserMapper.toAccountDTO);
    return this.ok({ users });
  }
}
