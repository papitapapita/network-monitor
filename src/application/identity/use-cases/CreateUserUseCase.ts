import { Result } from 'domain/shared/core';
import { User, UserEmail } from 'domain/identity';
import { IUserRepository } from 'domain/identity/repository/IUserRepository';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import {
  CreateUserRequestDTO,
  UserAccountDTO
} from '../dtos/UserManagementDTOs';
import { IPasswordService } from '../interfaces/IPasswordService';
import { UserMapper } from '../mappers/UserMapper';
import {
  assignableRole,
  checkPassword,
  withoutPasswords
} from '../services/userAccountPolicy';

export class CreateUserUseCase extends UseCase<
  CreateUserRequestDTO,
  UserAccountDTO
> {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly passwordService: IPasswordService,
    logger: ILogger
  ) {
    super(logger, 'CreateUserUseCase');
  }

  protected sanitizeForLogging(data: unknown): unknown {
    return withoutPasswords(data);
  }

  protected async executeImpl(
    request: CreateUserRequestDTO
  ): Promise<Result<UserAccountDTO>> {
    const email = UserEmail.create(request.email);
    if (email.isFailure) return this.fail(email.error!);

    const role = assignableRole(request.role);
    if (role.isFailure) return this.fail(role.error!);

    const weak = checkPassword(request.password);
    if (weak) return this.fail(weak);

    const created = User.create({
      email: email.value,
      role: role.value,
      passwordHash: await this.passwordService.hash(request.password)
    });
    if (created.isFailure) return this.fail(created.error!);

    const saved = await this.userRepository.save(created.value);
    if (saved.isFailure) return this.fail(saved.error!);

    return this.ok(UserMapper.toAccountDTO(created.value));
  }
}
