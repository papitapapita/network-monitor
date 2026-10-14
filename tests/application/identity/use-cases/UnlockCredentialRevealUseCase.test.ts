// Source: src/application/identity/use-cases/UnlockCredentialRevealUseCase.ts

import {
  UnlockCredentialRevealUseCase,
  WRONG_PASSWORD
} from '../../../../src/application/identity/use-cases/UnlockCredentialRevealUseCase';
import { ITokenService } from '../../../../src/application/identity/interfaces/ITokenService';
import { SignInSteps } from '../../../../src/application/identity/services/SignInSteps';
import { SIGN_IN_PAUSED } from '../../../../src/domain/identity/aggregates/User';
import { User } from '../../../../src/domain/identity/aggregates/User';
import { makeLogger } from '../../probe-agents/fixtures';
import {
  makePasswordService,
  makeUser,
  makeUserRepo
} from './userFixtures';

describe('[IDN-086] UnlockCredentialRevealUseCase', () => {
  const build = (users: User[]) => {
    const repo = makeUserRepo(users);
    const tokens: jest.Mocked<ITokenService> = {
      sign: jest.fn(),
      verify: jest.fn(),
      signChallenge: jest.fn().mockReturnValue('reveal.token'),
      verifyChallenge: jest.fn()
    };
    const logger = makeLogger();
    const useCase = new UnlockCredentialRevealUseCase(
      repo,
      makePasswordService(),
      tokens,
      new SignInSteps(repo, tokens),
      logger
    );
    return { useCase, repo, tokens, logger };
  };

  const unlock = (
    useCase: UnlockCredentialRevealUseCase,
    user: User,
    password: string
  ) =>
    useCase.execute({
      userId: user.id.toString(),
      password,
      sourceIp: '10.0.0.9'
    });

  it('opens a five-minute reveal bound to the account and its version', async () => {
    const user = makeUser('OPERATOR');
    const { useCase, tokens } = build([user]);

    const result = await unlock(useCase, user, 'current-pass');

    expect(result.value).toEqual({
      revealToken: 'reveal.token',
      expiresInSeconds: 300
    });
    expect(tokens.signChallenge).toHaveBeenCalledWith({
      userId: user.id.toString(),
      tokenVersion: user.tokenVersion,
      kind: 'credential-reveal'
    });
  });

  it('refuses a wrong password', async () => {
    const user = makeUser();
    const { useCase, tokens } = build([user]);

    const result = await unlock(useCase, user, 'guess');

    expect(result.error).toBe(WRONG_PASSWORD);
    expect(tokens.signChallenge).not.toHaveBeenCalled();
  });

  it('[IDN-044] counts a wrong password toward the sign-in pause', async () => {
    const user = makeUser();
    const { useCase, repo } = build([user]);

    await unlock(useCase, user, 'guess');

    expect(repo.save).toHaveBeenCalledWith(user);
    expect(user.failedSignIns).toBe(1);
  });

  it('[IDN-044] refuses even the right password while sign-in is paused', async () => {
    const user = makeUser();
    const { useCase, tokens } = build([user]);
    for (let i = 0; i < 5; i++) {
      user.recordFailedSignIn(new Date(), null);
    }

    const result = await unlock(useCase, user, 'current-pass');

    expect(result.error).toBe(SIGN_IN_PAUSED);
    expect(tokens.signChallenge).not.toHaveBeenCalled();
  });

  it('does not clear the failure count on the right password', async () => {
    const user = makeUser();
    user.recordFailedSignIn(new Date(), null);
    const { useCase } = build([user]);

    await unlock(useCase, user, 'current-pass');

    expect(user.failedSignIns).toBe(1);
  });

  it('refuses a disabled account', async () => {
    const user = makeUser();
    user.disable();
    const { useCase } = build([user]);

    const result = await unlock(useCase, user, 'current-pass');

    expect(result.error).toMatch(/User not found/);
  });

  it('never logs the password or the reveal token', async () => {
    const user = makeUser();
    const { useCase, logger } = build([user]);

    await unlock(useCase, user, 'current-pass');

    const text = JSON.stringify(logger.info.mock.calls);
    expect(text).not.toContain('current-pass');
    expect(text).not.toContain('reveal.token');
  });
});
