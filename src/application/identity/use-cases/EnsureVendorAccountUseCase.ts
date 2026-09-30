import { Result } from 'domain/shared/core';
import { User, UserEmail, UserRole } from 'domain/identity';
import { IUserRepository } from 'domain/identity/repository/IUserRepository';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import {
  EnsureVendorAccountRequestDTO,
  EnsureVendorAccountResponseDTO
} from '../dtos/EnsureVendorAccountDTOs';
import { IPasswordService } from '../interfaces/IPasswordService';

export const VENDOR_PASSWORD_MIN_LENGTH = 12;

// Runs at boot. An existing account keeps its password: the configured one is
// read only to create the account, so it can be removed from the environment
// afterwards.
export class EnsureVendorAccountUseCase extends UseCase<
  EnsureVendorAccountRequestDTO,
  EnsureVendorAccountResponseDTO
> {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly passwordService: IPasswordService,
    logger: ILogger
  ) {
    super(logger, 'EnsureVendorAccountUseCase');
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
    request: EnsureVendorAccountRequestDTO
  ): Promise<Result<EnsureVendorAccountResponseDTO>> {
    const emailResult = UserEmail.create(request.email);
    if (emailResult.isFailure) {
      return this.fail(
        `Invalid vendor account email: ${emailResult.error}`
      );
    }

    const found = await this.userRepository.findByEmail(
      emailResult.value
    );
    if (found.isFailure) {
      return this.fail(`Failed to look up user: ${found.error}`);
    }

    const vendor = UserRole.reconstitute(UserRole.VENDOR);
    const existing = found.value;

    if (existing) {
      if (existing.role.isVendor()) {
        return this.ok({
          userId: existing.id.toString(),
          outcome: 'unchanged'
        });
      }
      const changed = existing.changeRole(vendor);
      if (changed.isFailure) return this.fail(changed.error!);
      return this.persist(existing, 'promoted');
    }

    const password = request.password ?? '';
    if (password.length < VENDOR_PASSWORD_MIN_LENGTH) {
      return this.fail(
        `A password of at least ${VENDOR_PASSWORD_MIN_LENGTH} characters is required to create the vendor account`
      );
    }

    const created = User.create({
      email: emailResult.value,
      role: vendor,
      passwordHash: await this.passwordService.hash(password)
    });
    if (created.isFailure) return this.fail(created.error!);
    return this.persist(created.value, 'created');
  }

  private async persist(
    user: User,
    outcome: EnsureVendorAccountResponseDTO['outcome']
  ): Promise<Result<EnsureVendorAccountResponseDTO>> {
    const saved = await this.userRepository.save(user);
    if (saved.isFailure) {
      return this.fail(
        `Failed to save vendor account: ${saved.error}`
      );
    }
    return this.ok({ userId: user.id.toString(), outcome });
  }
}
