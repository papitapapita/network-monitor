// Source: src/application/identity/use-cases/ChangeOwnPasswordUseCase.ts

import {
  ChangeOwnPasswordUseCase,
  WRONG_CURRENT_PASSWORD
} from '../../../../src/application/identity/use-cases/ChangeOwnPasswordUseCase';
import { ITokenService } from '../../../../src/application/identity/interfaces/ITokenService';
import { User } from '../../../../src/domain/identity/aggregates/User';
import { makeLogger } from '../../probe-agents/fixtures';
import {
  makePasswordService,
  makeUser,
  makeUserRepo
} from './userFixtures';

describe('[IDN-144] ChangeOwnPasswordUseCase', () => {
  const build = (user: User) => {
    const repo = makeUserRepo([user]);
    const tokens: jest.Mocked<ITokenService> = {
      sign: jest.fn().mockReturnValue('fresh.token'),
      verify: jest.fn()
    };
    const logger = makeLogger();
    const useCase = new ChangeOwnPasswordUseCase(
      repo,
      makePasswordService(),
      tokens,
      logger
    );
    return { useCase, repo, tokens, logger };
  };

  it('changes the password and returns a token for the new version', async () => {
    const user = makeUser('VIEWER');
    const { useCase, tokens } = build(user);

    const result = await useCase.execute({
      userId: user.id.toString(),
      currentPassword: 'current-pass',
      newPassword: 'brand-new-pass'
    });

    expect(result.value).toEqual({ token: 'fresh.token' });
    expect(user.passwordHash).toBe('hashed:brand-new-pass');
    expect(tokens.sign).toHaveBeenCalledWith(
      expect.objectContaining({ tokenVersion: 1 })
    );
  });

  it('refuses a wrong current password', async () => {
    const user = makeUser();
    const { useCase, repo } = build(user);

    const result = await useCase.execute({
      userId: user.id.toString(),
      currentPassword: 'guess',
      newPassword: 'brand-new-pass'
    });

    expect(result.error).toBe(WRONG_CURRENT_PASSWORD);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('[IDN-142] refuses a short new password', async () => {
    const user = makeUser();
    const { useCase } = build(user);

    const result = await useCase.execute({
      userId: user.id.toString(),
      currentPassword: 'current-pass',
      newPassword: 'short'
    });

    expect(result.error).toBe(
      'Password must be at least 12 characters'
    );
  });

  it('[IDN-012] holds the vendor to 12 characters', async () => {
    const vendor = makeUser('VENDOR');
    const { useCase } = build(vendor);

    const result = await useCase.execute({
      userId: vendor.id.toString(),
      currentPassword: 'current-pass',
      newPassword: 'eleven-char'
    });

    expect(result.error).toBe(
      'Password must be at least 12 characters'
    );
  });

  it('never logs a password or the new token', async () => {
    const user = makeUser();
    const { useCase, logger } = build(user);

    await useCase.execute({
      userId: user.id.toString(),
      currentPassword: 'current-pass',
      newPassword: 'brand-new-pass'
    });

    const logged = JSON.stringify(logger.info.mock.calls);
    expect(logged).not.toContain('current-pass');
    expect(logged).not.toContain('brand-new-pass');
    expect(logged).not.toContain('fresh.token');
  });
});
