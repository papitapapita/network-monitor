import { Result } from 'domain/shared/core';
import { UserEmail } from 'domain/identity';
import { IUserRepository } from 'domain/identity/repository/IUserRepository';
import { UseCase } from 'application/shared/core';
import { IEmailSender, ILogger } from 'application/shared/interfaces';
import { ForgotPasswordRequestDTO } from '../dtos/PasswordResetDTOs';
import { ITokenService } from '../interfaces/ITokenService';
import { passwordResetEmail } from '../services/accountEmails';
import { sendWithoutWaiting } from '../services/sendWithoutWaiting';

// IDN-182. Answers the same for every address, known or not, and does not
// wait for the email, so neither the answer nor its timing tells a caller
// which addresses have accounts.
export class RequestPasswordResetUseCase extends UseCase<
  ForgotPasswordRequestDTO,
  void
> {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly tokenService: ITokenService,
    private readonly emailSender: IEmailSender,
    private readonly appPublicUrl: string | null,
    logger: ILogger
  ) {
    super(logger, 'RequestPasswordResetUseCase');
  }

  protected async executeImpl(
    request: ForgotPasswordRequestDTO
  ): Promise<Result<void>> {
    const email = UserEmail.create(request.email);
    if (email.isFailure) return this.ok(undefined);

    const found = await this.userRepository.findByEmail(email.value);
    if (found.isFailure) {
      return this.fail(`Failed to look up user: ${found.error}`);
    }
    const user = found.value;
    if (!user || user.isDisabled) return this.ok(undefined);

    if (this.appPublicUrl === null) {
      this.logger.warn(
        'RequestPasswordResetUseCase: APP_PUBLIC_URL is not set, no link to send',
        { userId: user.id.toString() }
      );
      return this.ok(undefined);
    }

    const token = this.tokenService.signChallenge({
      userId: user.id.toString(),
      tokenVersion: user.tokenVersion,
      kind: 'password-reset'
    });
    // In the fragment, which the browser never sends to a server or puts in
    // a Referer header.
    const link = `${this.appPublicUrl}/reset-password#token=${token}`;
    void sendWithoutWaiting(
      this.emailSender,
      passwordResetEmail(user.email.toString(), link),
      this.logger,
      {
        source: 'RequestPasswordResetUseCase',
        userId: user.id.toString()
      }
    );
    return this.ok(undefined);
  }
}
