// Source: src/application/identity/use-cases/LoginUseCase.ts

import { LoginUseCase } from '../../../../src/application/identity/use-cases/LoginUseCase';
import { IUserRepository } from '../../../../src/domain/identity/repository/IUserRepository';
import { IPasswordService } from '../../../../src/application/identity/interfaces/IPasswordService';
import {
  ChallengePayload,
  ITokenService
} from '../../../../src/application/identity/interfaces/ITokenService';
import { SignInSteps } from '../../../../src/application/identity/services/SignInSteps';
import {
  ILogger,
  LogContext
} from '../../../../src/application/shared/interfaces/ILogger';
import { Result } from '../../../../src/domain/shared/core/Result';
import {
  User,
  SIGN_IN_PAUSED
} from '../../../../src/domain/identity/aggregates/User';
import { UserSignInPausedEvent } from '../../../../src/domain/identity/events/UserSignInPausedEvent';
import { UserEmail } from '../../../../src/domain/identity/value-objects/UserEmail';
import { UserRole } from '../../../../src/domain/identity/value-objects/UserRole';
import { UserId } from '../../../../src/domain/shared/ids/UserId';
import { UserProps } from '../../../../src/domain/identity/props/UserProps';
import { LoginRequestDTO } from '../../../../src/application/identity/dtos/LoginRequestDTO';
import { TwoFactorStepDTO } from '../../../../src/application/identity/dtos/LoginResponseDTO';
import {
  challengeFor,
  makeTokens,
  withTwoFactor
} from './twoFactorFakes';

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
    save: jest.fn(async (u: User) => Result.ok<User>(u)),
    findById: jest.fn(),
    findAll: jest.fn(),
    findByEmail: jest.fn()
  };
}

function makePasswordService(): jest.Mocked<IPasswordService> {
  return {
    hash: jest.fn(),
    compare: jest.fn(),
    unusableHash: jest.fn()
  };
}

function makeTokenService(): jest.Mocked<ITokenService> {
  return {
    sign: jest.fn(),
    verify: jest.fn(),
    signChallenge: jest.fn().mockReturnValue('challenge.jwt'),
    verifyChallenge: jest.fn()
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
    disabledAt: null,
    tokenVersion: 0,
    failedSignIns: 0,
    signInPausedUntil: null,
    twoFactorSecret: null,
    twoFactorEnabledAt: null,
    twoFactorLastStep: null,
    recoveryCodeHashes: [],
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
    trustedBrowserToken: null,
    sourceIp: '203.0.113.7',
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
      new SignInSteps(userRepo, tokenService),
      logger
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  describe('happy path', () => {
    it('[IDN-166] answers the right password with a setup challenge while two-factor is off', async () => {
      const user = makeUser();
      userRepo.findByEmail.mockResolvedValue(Result.ok(user));
      passwordService.compare.mockResolvedValue(true);

      const result = await useCase.execute(makeRequest());

      expect(result.value).toEqual({
        twoFactor: 'setup',
        challengeToken: 'challenge.jwt'
      });
      expect(tokenService.signChallenge).toHaveBeenCalledWith({
        userId: user.id.toString(),
        tokenVersion: 0,
        kind: 'two-factor-setup'
      } satisfies ChallengePayload);
    });

    it('[IDN-166] answers the right password with a code challenge once two-factor is on', async () => {
      const user = makeUser();
      user.startTwoFactorSetup('encrypted');
      user.confirmTwoFactor(1, [], new Date());
      userRepo.findByEmail.mockResolvedValue(Result.ok(user));
      passwordService.compare.mockResolvedValue(true);

      const result = await useCase.execute(makeRequest());

      expect((result.value as TwoFactorStepDTO).twoFactor).toBe(
        'verify'
      );
      expect(tokenService.signChallenge.mock.calls[0][0].kind).toBe(
        'two-factor'
      );
    });

    it('[IDN-166] never opens a session on the password alone', async () => {
      userRepo.findByEmail.mockResolvedValue(Result.ok(makeUser()));
      passwordService.compare.mockResolvedValue(true);

      await useCase.execute(makeRequest());

      expect(tokenService.sign).not.toHaveBeenCalled();
    });

    it('[IDN-013] should refuse a disabled account like any wrong credentials', async () => {
      const user = makeUser('alice@example.com', 'OPERATOR');
      user.disable();
      userRepo.findByEmail.mockResolvedValue(Result.ok(user));
      passwordService.compare.mockResolvedValue(true);

      const result = await useCase.execute(makeRequest());

      expect(result.error).toBe('Invalid credentials');
      expect(tokenService.signChallenge).not.toHaveBeenCalled();
    });

    it('[IDN-065] should sign the current token version', async () => {
      const user = makeUser('alice@example.com', 'OPERATOR');
      user.changePassword('$2b$10$newer');
      userRepo.findByEmail.mockResolvedValue(Result.ok(user));
      passwordService.compare.mockResolvedValue(true);

      await useCase.execute(makeRequest());

      expect(
        tokenService.signChallenge.mock.calls[0][0].tokenVersion
      ).toBe(1);
    });

    it('should call passwordService.compare with the plain password and stored hash', async () => {
      const user = makeUser(
        'alice@example.com',
        'OPERATOR',
        '$2b$10$stored'
      );
      userRepo.findByEmail.mockResolvedValue(Result.ok(user));
      passwordService.compare.mockResolvedValue(true);

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

    it('should not issue a challenge when user is not found', async () => {
      userRepo.findByEmail.mockResolvedValue(Result.ok(null));

      await useCase.execute(makeRequest());

      expect(tokenService.signChallenge).not.toHaveBeenCalled();
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

    it('should not issue a challenge when password does not match', async () => {
      userRepo.findByEmail.mockResolvedValue(Result.ok(makeUser()));
      passwordService.compare.mockResolvedValue(false);

      await useCase.execute(makeRequest());

      expect(tokenService.signChallenge).not.toHaveBeenCalled();
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

  // =========================================================================
  describe('sign-in failures', () => {
    function pausedUser(): User {
      const user = makeUser();
      for (let i = 0; i < 5; i++)
        user.recordFailedSignIn(new Date(), null);
      user.clearEvents();
      return user;
    }

    it('[IDN-044] counts a wrong password and saves it', async () => {
      const user = makeUser();
      userRepo.findByEmail.mockResolvedValue(Result.ok(user));
      passwordService.compare.mockResolvedValue(false);

      const result = await useCase.execute(makeRequest());

      expect(result.error).toBe('Invalid credentials');
      expect(user.failedSignIns).toBe(1);
      expect(userRepo.save).toHaveBeenCalledWith(user);
    });

    it('[IDN-045] passes the caller address to the fifth failure', async () => {
      const user = makeUser();
      for (let i = 0; i < 4; i++)
        user.recordFailedSignIn(new Date(), null);
      userRepo.findByEmail.mockResolvedValue(Result.ok(user));
      passwordService.compare.mockResolvedValue(false);

      await useCase.execute(
        makeRequest({ sourceIp: '198.51.100.4' })
      );

      const event = user.domainEvents[0] as UserSignInPausedEvent;
      expect(event.sourceIp).toBe('198.51.100.4');
    });

    it('[IDN-044] refuses a paused account before checking the password', async () => {
      const user = pausedUser();
      userRepo.findByEmail.mockResolvedValue(Result.ok(user));
      passwordService.compare.mockResolvedValue(true);

      const result = await useCase.execute(makeRequest());

      expect(result.error).toBe(SIGN_IN_PAUSED);
      expect(passwordService.compare).not.toHaveBeenCalled();
      expect(tokenService.signChallenge).not.toHaveBeenCalled();
      expect(userRepo.save).not.toHaveBeenCalled();
    });

    it('[IDN-040] answers a disabled paused account like any wrong credentials', async () => {
      const user = pausedUser();
      user.disable();
      userRepo.findByEmail.mockResolvedValue(Result.ok(user));

      const result = await useCase.execute(makeRequest());

      expect(result.error).toBe('Invalid credentials');
    });

    it('[IDN-044] keeps the count after the right password: only the code clears it', async () => {
      const user = makeUser();
      user.recordFailedSignIn(new Date(), null);
      userRepo.findByEmail.mockResolvedValue(Result.ok(user));
      passwordService.compare.mockResolvedValue(true);

      const result = await useCase.execute(makeRequest());

      expect(result.isSuccess).toBe(true);
      expect(user.failedSignIns).toBe(1);
      expect(userRepo.save).not.toHaveBeenCalled();
    });

    it('does not save on the right password', async () => {
      userRepo.findByEmail.mockResolvedValue(Result.ok(makeUser()));
      passwordService.compare.mockResolvedValue(true);

      await useCase.execute(makeRequest());

      expect(userRepo.save).not.toHaveBeenCalled();
    });

    it('keeps the answer when the count cannot be saved', async () => {
      userRepo.findByEmail.mockResolvedValue(Result.ok(makeUser()));
      passwordService.compare.mockResolvedValue(false);
      userRepo.save.mockResolvedValue(Result.fail('db down'));

      const result = await useCase.execute(makeRequest());

      expect(result.error).toBe('Invalid credentials');
      expect(logger.error).toHaveBeenCalledWith(
        'SignInSteps: sign-in counter not saved',
        undefined,
        expect.objectContaining({ error: 'db down' })
      );
    });
  });

  // =========================================================================
  describe('remembered browser', () => {
    let tokens: jest.Mocked<ITokenService>;
    let remembered: LoginUseCase;

    beforeEach(() => {
      tokens = makeTokens();
      remembered = new LoginUseCase(
        userRepo,
        passwordService,
        new SignInSteps(userRepo, tokens),
        logger
      );
      passwordService.compare.mockResolvedValue(true);
    });

    const signInWith = (user: User, trustedBrowserToken: string) => {
      userRepo.findByEmail.mockResolvedValue(Result.ok(user));
      return remembered.execute(makeRequest({ trustedBrowserToken }));
    };

    it('[IDN-171] signs in without a code from a remembered browser', async () => {
      const user = withTwoFactor(makeUser());

      const result = await signInWith(
        user,
        challengeFor(user, 'trusted-browser')
      );

      expect(result.value).toEqual({
        token: 'session.jwt',
        user: expect.objectContaining({ id: user.id.toString() })
      });
    });

    it('[IDN-171] clears the failure count when it skips the code', async () => {
      const user = withTwoFactor(makeUser());
      user.recordFailedSignIn(new Date(), null);

      await signInWith(user, challengeFor(user, 'trusted-browser'));

      expect(user.failedSignIns).toBe(0);
      expect(userRepo.save).toHaveBeenCalledWith(user);
    });

    it('[IDN-171] still asks for the code once the sessions were ended', async () => {
      const user = withTwoFactor(makeUser());
      const token = challengeFor(user, 'trusted-browser');
      user.changeRole(UserRole.reconstitute('VIEWER'));

      const result = await signInWith(user, token);

      expect((result.value as TwoFactorStepDTO).twoFactor).toBe(
        'verify'
      );
    });

    it("[IDN-171] does not trust another account's browser", async () => {
      const user = withTwoFactor(makeUser());
      const other = withTwoFactor(makeUser('bob@example.com'));

      const result = await signInWith(
        user,
        challengeFor(other, 'trusted-browser')
      );

      expect((result.value as TwoFactorStepDTO).twoFactor).toBe(
        'verify'
      );
    });

    it('[IDN-171] a challenge is no remembered browser', async () => {
      const user = withTwoFactor(makeUser());

      const result = await signInWith(
        user,
        challengeFor(user, 'two-factor')
      );

      expect((result.value as TwoFactorStepDTO).twoFactor).toBe(
        'verify'
      );
    });

    it('[IDN-171] an account without two-factor sets it up anyway', async () => {
      const user = makeUser();

      const result = await signInWith(
        user,
        challengeFor(user, 'trusted-browser')
      );

      expect((result.value as TwoFactorStepDTO).twoFactor).toBe(
        'setup'
      );
    });

    it('[IDN-171] the password is still checked', async () => {
      const user = withTwoFactor(makeUser());
      passwordService.compare.mockResolvedValue(false);

      const result = await signInWith(
        user,
        challengeFor(user, 'trusted-browser')
      );

      expect(result.error).toBe('Invalid credentials');
      expect(tokens.sign).not.toHaveBeenCalled();
    });

    it('[IDN-171] gives no session when the sign-in cannot be saved', async () => {
      const user = withTwoFactor(makeUser());
      userRepo.save.mockResolvedValueOnce(
        Result.fail<User>('db down')
      );

      const result = await signInWith(
        user,
        challengeFor(user, 'trusted-browser')
      );

      expect(result.isFailure).toBe(true);
    });

    it('[IDN-041] never logs the remembered-browser token', async () => {
      const user = withTwoFactor(makeUser());
      const token = challengeFor(user, 'trusted-browser');

      await signInWith(user, token);

      const logged = JSON.stringify(
        (logger.info as jest.Mock).mock.calls
      );
      expect(logged).not.toContain(token);
      expect(logged).not.toContain('session.jwt');
    });
  });
});
