import { Result } from 'domain/shared/core';
import { UserEmail } from 'domain/identity';
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
    if (!user) {
      return this.fail('Invalid credentials');
    }

    const passwordMatch = await this.passwordService.compare(
      request.password,
      user.passwordHash
    );
    if (!passwordMatch) {
      return this.fail('Invalid credentials');
    }

    const token = this.tokenService.sign({
      userId: user.id.toString(),
      email: user.email.toString(),
      role: user.role.toString()
    });

    return this.ok({ token, user: UserMapper.toDTO(user) });
  }
}
