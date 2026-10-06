// Source: src/application/identity/use-cases/EnsureVendorAccountUseCase.ts

import {
  EnsureVendorAccountUseCase,
  VENDOR_PASSWORD_MIN_LENGTH
} from '../../../../src/application/identity/use-cases/EnsureVendorAccountUseCase';
import { IUserRepository } from '../../../../src/domain/identity/repository/IUserRepository';
import { IPasswordService } from '../../../../src/application/identity/interfaces/IPasswordService';
import {
  ILogger,
  LogContext
} from '../../../../src/application/shared/interfaces/ILogger';
import { Result } from '../../../../src/domain/shared/core/Result';
import { User } from '../../../../src/domain/identity/aggregates/User';
import { UserEmail } from '../../../../src/domain/identity/value-objects/UserEmail';
import { UserRole } from '../../../../src/domain/identity/value-objects/UserRole';
import { UserId } from '../../../../src/domain/shared/ids/UserId';

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

function makeUserRepo(
  existing: User | null = null
): jest.Mocked<IUserRepository> {
  return {
    save: jest.fn(async (u: User) => Result.ok<User>(u)),
    findById: jest.fn(),
    findAll: jest.fn(),
    findByEmail: jest
      .fn()
      .mockResolvedValue(Result.ok<User | null>(existing))
  };
}

function makePasswordService(): jest.Mocked<IPasswordService> {
  return {
    hash: jest.fn(async (plain: string) => `hashed:${plain}`),
    compare: jest.fn()
  };
}

function makeUser(role: string): User {
  const now = new Date('2024-01-01T00:00:00.000Z');
  return User.reconstitute(UserId.create(), {
    email: UserEmail.reconstitute('owner@isp.example'),
    role: UserRole.reconstitute(role),
    passwordHash: '$2b$10$existing',
    disabledAt: null,
    tokenVersion: 0,
    failedSignIns: 0,
    signInPausedUntil: null,
    createdAt: now,
    updatedAt: now
  });
}

const PASSWORD = 'a-long-enough-password';

describe('EnsureVendorAccountUseCase', () => {
  const build = (existing: User | null = null) => {
    const repo = makeUserRepo(existing);
    const passwords = makePasswordService();
    const logger = makeLogger();
    const useCase = new EnsureVendorAccountUseCase(
      repo,
      passwords,
      logger
    );
    return { useCase, repo, passwords, logger };
  };

  describe('[IDN-011] no account with that email', () => {
    it('creates a VENDOR with the hashed password', async () => {
      const { useCase, repo } = build();

      const result = await useCase.execute({
        email: 'Owner@ISP.example',
        password: PASSWORD
      });

      expect(result.value.outcome).toBe('created');
      const saved = repo.save.mock.calls[0][0];
      expect(saved.role.isVendor()).toBe(true);
      expect(saved.email.toString()).toBe('owner@isp.example');
      expect(saved.passwordHash).toBe(`hashed:${PASSWORD}`);
    });

    it('[IDN-012] refuses without a password', async () => {
      const { useCase, repo } = build();

      const result = await useCase.execute({
        email: 'owner@isp.example'
      });

      expect(result.error).toBe(
        `A password of at least ${VENDOR_PASSWORD_MIN_LENGTH} characters is required to create the vendor account`
      );
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('[IDN-012] refuses a password shorter than 12 characters', async () => {
      const { useCase, repo } = build();

      const result = await useCase.execute({
        email: 'owner@isp.example',
        password: 'x'.repeat(VENDOR_PASSWORD_MIN_LENGTH - 1)
      });

      expect(result.isFailure).toBe(true);
      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  describe('[IDN-011] an account with that email exists', () => {
    it('promotes an ADMIN to VENDOR and keeps its password', async () => {
      const owner = makeUser('ADMIN');
      const { useCase, repo, passwords } = build(owner);

      const result = await useCase.execute({
        email: 'owner@isp.example',
        password: PASSWORD
      });

      expect(result.value).toEqual({
        userId: owner.id.toString(),
        outcome: 'promoted'
      });
      expect(repo.save.mock.calls[0][0].role.isVendor()).toBe(true);
      expect(owner.passwordHash).toBe('$2b$10$existing');
      expect(passwords.hash).not.toHaveBeenCalled();
    });

    it('promotes without needing a password', async () => {
      const { useCase } = build(makeUser('OPERATOR'));

      const result = await useCase.execute({
        email: 'owner@isp.example'
      });

      expect(result.value.outcome).toBe('promoted');
    });

    it('leaves a VENDOR untouched', async () => {
      const { useCase, repo } = build(makeUser('VENDOR'));

      const result = await useCase.execute({
        email: 'owner@isp.example'
      });

      expect(result.value.outcome).toBe('unchanged');
      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  it('fails on a malformed email', async () => {
    const { useCase } = build();

    const result = await useCase.execute({
      email: 'not-an-email',
      password: PASSWORD
    });

    expect(result.error).toContain('Invalid vendor account email');
  });

  it('reports a repository failure', async () => {
    const { useCase, repo } = build();
    repo.findByEmail.mockResolvedValue(
      Result.fail<User | null>('db down')
    );

    const result = await useCase.execute({
      email: 'owner@isp.example',
      password: PASSWORD
    });

    expect(result.error).toContain('db down');
  });

  it('reports a save failure', async () => {
    const { useCase, repo } = build();
    repo.save.mockResolvedValue(Result.fail<User>('disk full'));

    const result = await useCase.execute({
      email: 'owner@isp.example',
      password: PASSWORD
    });

    expect(result.error).toContain('disk full');
  });

  it('[IDN-041] never logs the password', async () => {
    const { useCase, logger } = build();

    await useCase.execute({
      email: 'owner@isp.example',
      password: PASSWORD
    });

    const logged = JSON.stringify(
      (logger.info as jest.Mock).mock.calls.concat(
        (logger.debug as jest.Mock).mock.calls
      )
    );
    expect(logged).not.toContain(PASSWORD);
  });
});
