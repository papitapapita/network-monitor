import { Result } from 'domain/shared/core';
import { User, UserEmail } from 'domain/identity';
import { IUserRepository } from 'domain/identity/repository/IUserRepository';
import { UseCase } from 'application/shared/core';
import { IEmailSender, ILogger } from 'application/shared/interfaces';
import {
  CreateUserRequestDTO,
  UserAccountDTO
} from '../dtos/UserManagementDTOs';
import { IPasswordService } from '../interfaces/IPasswordService';
import { ITokenService } from '../interfaces/ITokenService';
import { UserMapper } from '../mappers/UserMapper';
import { invitationEmail } from '../services/accountEmails';
import {
  assignableRole,
  checkPassword,
  withoutPasswords
} from '../services/userAccountPolicy';

export const EMAIL_TAKEN = 'A user with this email already exists';
export const INVITATION_NOT_SENT =
  'The invitation email could not be sent. Try again, or set a password instead.';

export class CreateUserUseCase extends UseCase<
  CreateUserRequestDTO,
  UserAccountDTO
> {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly passwordService: IPasswordService,
    private readonly tokenService: ITokenService,
    private readonly emailSender: IEmailSender,
    private readonly appPublicUrl: string | null,
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

    if (request.password === null) {
      return this.invite(email.value, role.value);
    }

    const weak = checkPassword(request.password);
    if (weak) return this.fail(weak);

    const created = User.create({
      email: email.value,
      role: role.value,
      passwordHash: await this.passwordService.hash(request.password)
    });
    if (created.isFailure) return this.fail(created.error!);

    return this.save(created.value);
  }

  // IDN-184. The email goes out before the account is saved, so an
  // invitation that cannot be delivered leaves no account nobody can open.
  private async invite(
    email: UserEmail,
    role: User['role']
  ): Promise<Result<UserAccountDTO>> {
    if (this.appPublicUrl === null)
      return this.fail(INVITATION_NOT_SENT);

    const existing = await this.userRepository.findByEmail(email);
    if (existing.isFailure) {
      return this.fail(`Failed to look up user: ${existing.error}`);
    }
    if (existing.value) return this.fail(EMAIL_TAKEN);

    const created = User.create({
      email,
      role,
      passwordHash: await this.passwordService.unusableHash()
    });
    if (created.isFailure) return this.fail(created.error!);
    const user = created.value;

    const token = this.tokenService.signChallenge({
      userId: user.id.toString(),
      tokenVersion: user.tokenVersion,
      kind: 'invitation'
    });
    const sent = await this.emailSender.send(
      invitationEmail(
        user.email.toString(),
        `${this.appPublicUrl}/accept-invitation#token=${token}`
      )
    );
    if (sent.isFailure) {
      this.logger.warn('CreateUserUseCase: invitation not sent', {
        error: sent.error
      });
      return this.fail(INVITATION_NOT_SENT);
    }

    return this.save(user);
  }

  private async save(user: User): Promise<Result<UserAccountDTO>> {
    const saved = await this.userRepository.save(user);
    if (saved.isFailure) return this.fail(saved.error!);
    return this.ok(UserMapper.toAccountDTO(user));
  }
}
