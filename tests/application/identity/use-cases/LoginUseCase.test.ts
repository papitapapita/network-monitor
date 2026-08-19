// Source: src/application/identity/use-cases/LoginUseCase.ts

import { LoginUseCase } from '../../../../src/application/identity/use-cases/LoginUseCase';
import { IUserRepository } from '../../../../src/domain/identity/repository/IUserRepository';
import { IPasswordService } from '../../../../src/application/identity/interfaces/IPasswordService';
import {
  ITokenService,
  TokenPayload
} from '../../../../src/application/identity/interfaces/ITokenService';
import {
  ILogger,
  LogContext
} from '../../../../src/application/shared/interfaces/ILogger';
import { Result } from '../../../../src/domain/shared/core/Result';
import { User } from '../../../../src/domain/identity/aggregates/User';
import { UserEmail } from '../../../../src/domain/identity/value-objects/UserEmail';
import { UserRole } from '../../../../src/domain/identity/value-objects/UserRole';
import { UserId } from '../../../../src/domain/shared/ids/UserId';
import { UserProps } from '../../../../src/domain/identity/props/UserProps';
import { LoginRequestDTO } from '../../../../src/application/identity/dtos/LoginRequestDTO';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function makeLogger(): ILogger {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
    child: jest.fn().mockReturnThis() as (
      context: LogContext
    ) => ILogger,
    setLevel: jest.fn()
  };
}

function makeUserRepo(): jest.Mocked<IUserRepository> {
  return {
    save: jest.fn(),
    findById: jest.fn(),
    findByEmail: jest.fn()
  };
}

function makePasswordService(): jest.Mocked<IPasswordService> {
  return {
    hash: jest.fn(),
    compare: jest.fn()
  };
}

function makeTokenService(): jest.Mocked<ITokenService> {
  return {
    sign: jest.fn(),
    verify: jest.fn()
  };
}

function makeUser(
  emailRaw = 'alice@example.com',
  roleRaw = 'OPERATOR',
  passwordHash = '$2b$10$abc'
): User {
  const id = UserId.create();
  const now = new Date('2024-01-01T00:00:00.000Z');
  const props: UserProps = {
    email: UserEmail.reconstitute(emailRaw),
    role: UserRole.reconstitute(roleRaw),
    passwordHash,
    createdAt: now,
    updatedAt: now
  };
  return User.reconstitute(id, props);
}

function makeRequest(
  overrides: Partial<LoginRequestDTO> = {}
): LoginRequestDTO {
  return {
    email: 'alice@example.com',
    password: 'secret123',
    ...overrides
  };
}

// ---------------------------------------------------------------------------

describe('LoginUseCase', () => {
  let userRepo: jest.Mocked<IUserRepository>;
  let passwordService: jest.Mocked<IPasswordService>;
  let tokenService: jest.Mocked<ITokenService>;
  let logger: ILogger;
  let useCase: LoginUseCase;

  beforeEach(() => {
    userRepo = makeUserRepo();
    passwordService = makePasswordService();
    tokenService = makeTokenService();
    logger = makeLogger();
    useCase = new LoginUseCase(
      userRepo,
      passwordService,
      tokenService,
      logger
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  describe('happy path', () => {
    it('should return Result.ok with a token and user DTO on valid credentials', async () => {
      const user = makeUser();
      userRepo.findByEmail.mockResolvedValue(Result.ok(user));
      passwordService.compare.mockResolvedValue(true);
      tokenService.sign.mockReturnValue('signed.jwt.token');

      const result = await useCase.execute(makeRequest());

      expect(result.isSuccess).toBe(true);
      expect(result.value.token).toBe('signed.jwt.token');
    });

    it('should include id, email, and role in the user DTO', async () => {
      const user = makeUser('alice@example.com', 'ADMIN');
      userRepo.findByEmail.mockResolvedValue(Result.ok(user));
      passwordService.compare.mockResolvedValue(true);
      tokenService.sign.mockReturnValue('tok');

      const result = await useCase.execute(makeRequest());

      expect(result.value.user.id).toBe(user.id.toString());
      expect(result.value.user.email).toBe('alice@example.com');
      expect(result.value.user.role).toBe('ADMIN');
    });

    it('should call tokenService.sign with userId, email, and role', async () => {
      const user = makeUser('alice@example.com', 'OPERATOR');
      userRepo.findByEmail.mockResolvedValue(Result.ok(user));
      passwordService.compare.mockResolvedValue(true);
      tokenService.sign.mockReturnValue('tok');

      await useCase.execute(makeRequest());

      expect(tokenService.sign).toHaveBeenCalledWith({
        userId: user.id.toString(),
        email: 'alice@example.com',
        role: 'OPERATOR'
      } satisfies TokenPayload);
    });

    it('should call passwordService.compare with the plain password and stored hash', async () => {
      const user = makeUser(
        'alice@example.com',
        'OPERATOR',
        '$2b$10$stored'
      );
      userRepo.findByEmail.mockResolvedValue(Result.ok(user));
      passwordService.compare.mockResolvedValue(true);
      tokenService.sign.mockReturnValue('tok');

      await useCase.execute(makeRequest({ password: 'plain-pass' }));

      expect(passwordService.compare).toHaveBeenCalledWith(
        'plain-pass',
        '$2b$10$stored'
      );
    });

    it('should call findByEmail with a UserEmail value object matching the request', async () => {
      const user = makeUser();
      userRepo.findByEmail.mockResolvedValue(Result.ok(user));
      passwordService.compare.mockResolvedValue(true);
      tokenService.sign.mockReturnValue('tok');

      await useCase.execute(
        makeRequest({ email: 'alice@example.com' })
      );

      expect(userRepo.findByEmail).toHaveBeenCalledTimes(1);
      const calledWith = userRepo.findByEmail.mock.calls[0][0];
      expect(calledWith).toBeInstanceOf(UserEmail);
      expect(calledWith.toString()).toBe('alice@example.com');
    });
  });

  // =========================================================================
  describe('credential validation — user not found', () => {
    it('should return Result.fail when user does not exist in the repository', async () => {
      userRepo.findByEmail.mockResolvedValue(Result.ok(null));

      const result = await useCase.execute(makeRequest());

      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Invalid credentials');
    });

    it('should not call passwordService when user is not found', async () => {
      userRepo.findByEmail.mockResolvedValue(Result.ok(null));

      await useCase.execute(makeRequest());

      expect(passwordService.compare).not.toHaveBeenCalled();
    });

    it('should not call tokenService when user is not found', async () => {
      userRepo.findByEmail.mockResolvedValue(Result.ok(null));

      await useCase.execute(makeRequest());

      expect(tokenService.sign).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  describe('credential validation — wrong password', () => {
    it('should return Result.fail when password does not match', async () => {
      userRepo.findByEmail.mockResolvedValue(Result.ok(makeUser()));
      passwordService.compare.mockResolvedValue(false);

      const result = await useCase.execute(makeRequest());

      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Invalid credentials');
    });

    it('should not call tokenService when password does not match', async () => {
      userRepo.findByEmail.mockResolvedValue(Result.ok(makeUser()));
      passwordService.compare.mockResolvedValue(false);

      await useCase.execute(makeRequest());

      expect(tokenService.sign).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  describe('error message uniformity (no credential enumeration)', () => {
    it('should return the same error message for a missing user as for a wrong password', async () => {
      userRepo.findByEmail.mockResolvedValue(Result.ok(null));
      const missingUserResult = await useCase.execute(makeRequest());

      userRepo.findByEmail.mockResolvedValue(Result.ok(makeUser()));
      passwordService.compare.mockResolvedValue(false);
      const wrongPasswordResult =
        await useCase.execute(makeRequest());

      expect(missingUserResult.error).toBe(wrongPasswordResult.error);
    });
  });

  // =========================================================================
  describe('repository failure', () => {
    it('should return Result.fail when repository lookup fails', async () => {
      userRepo.findByEmail.mockResolvedValue(
        Result.fail('DB connection lost')
      );

      const result = await useCase.execute(makeRequest());

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Failed to look up user');
    });

    it('should not call passwordService when repository fails', async () => {
      userRepo.findByEmail.mockResolvedValue(Result.fail('timeout'));

      await useCase.execute(makeRequest());

      expect(passwordService.compare).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  describe('invalid email in request', () => {
    it('should return Result.fail when request email is not a valid email address', async () => {
      const result = await useCase.execute(
        makeRequest({ email: 'not-an-email' })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Invalid credentials');
    });

    it('should not call the repository when email format is invalid', async () => {
      await useCase.execute(makeRequest({ email: 'bad@@bad' }));

      expect(userRepo.findByEmail).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  describe('sanitizeForLogging', () => {
    it('should strip the password field before the use case logs the request', async () => {
      userRepo.findByEmail.mockResolvedValue(Result.ok(makeUser()));
      passwordService.compare.mockResolvedValue(true);
      tokenService.sign.mockReturnValue('tok');

      await useCase.execute(
        makeRequest({ password: 'super-secret' })
      );

      const infoMock = (logger.info as jest.Mock).mock;
      const loggedRequests = infoMock.calls
        .map(
          ([, ctx]: [string, Record<string, unknown>]) => ctx?.request
        )
        .filter(Boolean);

      for (const req of loggedRequests) {
        expect(req).not.toHaveProperty('password');
      }
    });
  });
});
