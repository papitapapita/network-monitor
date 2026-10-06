// Source: src/application/identity/use-cases/ResetPasswordUseCase.ts

import {
  RESET_LINK_EXPIRED,
  ResetPasswordUseCase
} from '../../../../src/application/identity/use-cases/ResetPasswordUseCase';
import { PASSWORD_TOO_SHORT } from '../../../../src/application/identity/services/userAccountPolicy';
import { IPasswordService } from '../../../../src/application/identity/interfaces/IPasswordService';
import { User } from '../../../../src/domain/identity/aggregates/User';
import { makeLogger } from '../../probe-agents/fixtures';
import { makeUser, makeUserRepo } from './userFixtures';
import {
  challengeFor,
  makeTokens,
  withTwoFactor
} from './twoFactorFakes';

describe('[IDN-183] ResetPasswordUseCase', () => {
  const NEW_PASSWORD = 'a-new-long-password';

  const build = (user: User) => {
    const repo = makeUserRepo([user]);
    const passwords: jest.Mocked<IPasswordService> = {
      hash: jest.fn(async (p: string) => `hash:${p}`),
      compare: jest.fn()
    };
    const useCase = new ResetPasswordUseCase(
      repo,
      passwords,
      makeTokens(),
      makeLogger()
    );
    const reset = (
      token = challengeFor(user, 'password-reset'),
      password = NEW_PASSWORD
    ) => useCase.execute({ token, password });
    return { repo, reset };
  };

  it('sets the new password, ends the sessions and keeps two-factor', async () => {
    const user = withTwoFactor(makeUser());
    const { repo, reset } = build(user);

    const result = await reset();

    expect(result.isSuccess).toBe(true);
    expect(user.passwordHash).toBe(`hash:${NEW_PASSWORD}`);
    expect(user.tokenVersion).toBe(1);
    expect(user.hasTwoFactor).toBe(true);
    expect(repo.save).toHaveBeenCalledWith(user);
  });

  it('works only once', async () => {
    const user = makeUser();
    const { reset } = build(user);
    const token = challengeFor(user, 'password-reset');

    await reset(token);

    expect((await reset(token)).error).toBe(RESET_LINK_EXPIRED);
  });

  it('[IDN-044] lifts a sign-in pause', async () => {
    const user = makeUser();
    for (let i = 0; i < 5; i++)
      user.recordFailedSignIn(new Date(), null);
    const { reset } = build(user);

    await reset();

    expect(user.isSignInPaused(new Date())).toBe(false);
  });

  it('refuses another kind of token', async () => {
    const user = makeUser();
    const { reset } = build(user);

    expect(
      (await reset(challengeFor(user, 'two-factor'))).error
    ).toBe(RESET_LINK_EXPIRED);
  });

  it('refuses a disabled account', async () => {
    const user = makeUser();
    const token = challengeFor(user, 'password-reset');
    user.disable();
    const { reset } = build(user);

    expect((await reset(token)).error).toBe(RESET_LINK_EXPIRED);
  });

  it('[IDN-142] refuses a short password and keeps the link', async () => {
    const user = makeUser();
    const { reset } = build(user);

    expect((await reset(undefined, 'short')).error).toBe(
      PASSWORD_TOO_SHORT
    );
    expect((await reset()).isSuccess).toBe(true);
  });
});
