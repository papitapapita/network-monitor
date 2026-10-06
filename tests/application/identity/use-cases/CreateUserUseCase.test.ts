// Source: src/application/identity/use-cases/CreateUserUseCase.ts

import { CreateUserUseCase } from '../../../../src/application/identity/use-cases/CreateUserUseCase';
import {
  PASSWORD_TOO_SHORT,
  VENDOR_ROLE_NOT_ASSIGNABLE
} from '../../../../src/application/identity/services/userAccountPolicy';
import { Result } from '../../../../src/domain/shared/core/Result';
import { User } from '../../../../src/domain/identity/aggregates/User';
import { makeLogger } from '../../probe-agents/fixtures';
import { makePasswordService, makeUserRepo } from './userFixtures';

describe('CreateUserUseCase', () => {
  const build = () => {
    const repo = makeUserRepo();
    const logger = makeLogger();
    const useCase = new CreateUserUseCase(
      repo,
      makePasswordService(),
      logger
    );
    return { useCase, repo, logger };
  };

  it('[IDN-140] creates an enabled account with the hashed password', async () => {
    const { useCase, repo } = build();

    const result = await useCase.execute({
      email: 'New@ISP.example',
      password: 'twelve-chars',
      role: 'operator'
    });

    expect(result.value).toMatchObject({
      email: 'new@isp.example',
      role: 'OPERATOR',
      disabled: false
    });
    expect(repo.save.mock.calls[0][0].passwordHash).toBe(
      'hashed:twelve-chars'
    );
  });

  it('[IDN-141] refuses the VENDOR role', async () => {
    const { useCase, repo } = build();

    const result = await useCase.execute({
      email: 'new@isp.example',
      password: 'long-enough-pass',
      role: 'VENDOR'
    });

    expect(result.error).toBe(VENDOR_ROLE_NOT_ASSIGNABLE);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('[IDN-142] refuses a password under 12 characters', async () => {
    const { useCase } = build();

    const result = await useCase.execute({
      email: 'new@isp.example',
      password: 'eleven-char',
      role: 'VIEWER'
    });

    expect(result.error).toBe(PASSWORD_TOO_SHORT);
  });

  it('refuses a malformed email and an unknown role', async () => {
    const { useCase } = build();

    expect(
      (
        await useCase.execute({
          email: 'nope',
          password: 'long-enough-pass',
          role: 'VIEWER'
        })
      ).error
    ).toBe('Email is not valid');
    expect(
      (
        await useCase.execute({
          email: 'a@b.co',
          password: 'long-enough-pass',
          role: 'ROOT'
        })
      ).error
    ).toContain('Invalid role');
  });

  it('[IDN-004] passes on a duplicate email', async () => {
    const { useCase, repo } = build();
    repo.save.mockResolvedValue(
      Result.fail<User>('A user with this email already exists')
    );

    const result = await useCase.execute({
      email: 'taken@isp.example',
      password: 'long-enough-pass',
      role: 'VIEWER'
    });

    expect(result.error).toBe(
      'A user with this email already exists'
    );
  });

  it('never logs the password', async () => {
    const { useCase, logger } = build();

    await useCase.execute({
      email: 'new@isp.example',
      password: 'super-secret-pass',
      role: 'VIEWER'
    });

    expect(JSON.stringify(logger.info.mock.calls)).not.toContain(
      'super-secret-pass'
    );
  });
});
