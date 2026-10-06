import { VerifyTwoFactorUseCase } from '../../../../src/application/identity/use-cases/VerifyTwoFactorUseCase';
import {
  INVALID_CODE,
  SIGN_IN_STEP_EXPIRED,
  SignInSteps
} from '../../../../src/application/identity/services/SignInSteps';
import {
  SIGN_IN_PAUSED,
  User
} from '../../../../src/domain/identity/aggregates/User';
import { Result } from '../../../../src/domain/shared/core/Result';
import { makeLogger } from '../../probe-agents/fixtures';
import { makeUser, makeUserRepo } from './userFixtures';
import {
  GOOD_CODE,
  GOOD_STEP,
  challengeFor,
  makeCipher,
  makeCodes,
  makeRecoveryCodes,
  makeTokens,
  withTwoFactor
} from './twoFactorFakes';

describe('[IDN-170] VerifyTwoFactorUseCase', () => {
  const build = (user: User = withTwoFactor(makeUser())) => {
    const repo = makeUserRepo([user]);
    const tokens = makeTokens();
    const codes = makeCodes();
    const logger = makeLogger();
    const useCase = new VerifyTwoFactorUseCase(
      repo,
      new SignInSteps(repo, tokens),
      codes,
      makeRecoveryCodes(),
      makeCipher(),
      logger
    );
    const verify = (
      answer: { code?: string; recoveryCode?: string },
      kind: 'two-factor' | 'two-factor-setup' = 'two-factor'
    ) =>
      useCase.execute({
        challengeToken: challengeFor(user, kind),
        code: answer.code ?? null,
        recoveryCode: answer.recoveryCode ?? null,
        sourceIp: '203.0.113.7'
      });
    return { user, repo, tokens, codes, logger, verify };
  };

  it('signs in with a code from the app and remembers its step', async () => {
    const { user, repo, codes, verify } = build();

    const result = await verify({ code: GOOD_CODE });

    expect(result.value).toEqual({
      token: 'session.jwt',
      user: {
        id: user.id.toString(),
        email: 'staff@isp.example',
        role: 'OPERATOR'
      }
    });
    expect(codes.matchStep).toHaveBeenCalledWith(
      'SECRET',
      GOOD_CODE,
      expect.any(Date)
    );
    expect(user.twoFactorLastStep).toBe(GOOD_STEP);
    expect(repo.save).toHaveBeenCalledWith(user);
  });

  it('[IDN-163] signs in with a recovery code, however it is typed, and spends it', async () => {
    const { user, verify } = build();

    const result = await verify({ recoveryCode: ' aaaaa bbbbb ' });

    expect(result.isSuccess).toBe(true);
    expect(user.recoveryCodeHashes).toEqual([]);
  });

  it('[IDN-163] refuses a spent recovery code', async () => {
    const { verify } = build();
    await verify({ recoveryCode: 'AAAAA-BBBBB' });

    const result = await verify({ recoveryCode: 'AAAAA-BBBBB' });

    expect(result.error).toBe(INVALID_CODE);
  });

  it('[IDN-044] counts a wrong code', async () => {
    const { user, tokens, verify } = build();

    const result = await verify({ code: '000000' });

    expect(result.error).toBe(INVALID_CODE);
    expect(user.failedSignIns).toBe(1);
    expect(tokens.sign).not.toHaveBeenCalled();
  });

  it('[IDN-164] counts a code already used as a wrong one', async () => {
    const { user, verify } = build();
    await verify({ code: GOOD_CODE });

    const result = await verify({ code: GOOD_CODE });

    expect(result.error).toBe(INVALID_CODE);
    expect(user.failedSignIns).toBe(1);
  });

  it('[IDN-044] counts an unknown recovery code', async () => {
    const { user, verify } = build();

    await verify({ recoveryCode: 'ZZZZZ-ZZZZZ' });

    expect(user.failedSignIns).toBe(1);
  });

  it('[IDN-045] passes the caller address to the fifth failure', async () => {
    const { user, verify } = build();
    for (let i = 0; i < 4; i++)
      user.recordFailedSignIn(new Date(), null);
    user.clearEvents();

    await verify({ code: '000000' });

    expect(user.domainEvents).toHaveLength(1);
  });

  it('[IDN-044] clears the count on success', async () => {
    const user = withTwoFactor(makeUser());
    user.recordFailedSignIn(new Date(), null);
    const { verify } = build(user);

    await verify({ code: GOOD_CODE });

    expect(user.failedSignIns).toBe(0);
  });

  it('[IDN-044] refuses during a pause without checking the code', async () => {
    const user = withTwoFactor(makeUser());
    for (let i = 0; i < 5; i++)
      user.recordFailedSignIn(new Date(), null);
    const { codes, verify } = build(user);

    const result = await verify({ code: GOOD_CODE });

    expect(result.error).toBe(SIGN_IN_PAUSED);
    expect(codes.matchStep).not.toHaveBeenCalled();
  });

  it('[IDN-167] refuses a setup challenge', async () => {
    const { verify } = build();

    const result = await verify(
      { code: GOOD_CODE },
      'two-factor-setup'
    );

    expect(result.error).toBe(SIGN_IN_STEP_EXPIRED);
  });

  it('[IDN-167] refuses an account whose two-factor is off', async () => {
    const { verify } = build(makeUser());

    const result = await verify({ code: GOOD_CODE });

    expect(result.error).toBe(SIGN_IN_STEP_EXPIRED);
  });

  it('gives no session when the used code cannot be saved', async () => {
    const { repo, tokens, verify } = build();
    repo.save.mockResolvedValue(Result.fail('db down'));

    const result = await verify({ code: GOOD_CODE });

    expect(result.isFailure).toBe(true);
    expect(tokens.sign).not.toHaveBeenCalled();
  });

  it('keeps codes out of the logs', async () => {
    const { logger, verify } = build();

    await verify({ recoveryCode: 'AAAAA-BBBBB' });

    expect(JSON.stringify(logger.info.mock.calls)).not.toContain(
      'AAAAA'
    );
  });
});
