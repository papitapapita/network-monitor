import { ConfirmTwoFactorSetupUseCase } from '../../../../src/application/identity/use-cases/ConfirmTwoFactorSetupUseCase';
import {
  INVALID_CODE,
  SIGN_IN_STEP_EXPIRED,
  SignInSteps
} from '../../../../src/application/identity/services/SignInSteps';
import {
  SIGN_IN_PAUSED,
  TWO_FACTOR_ALREADY_ON,
  TWO_FACTOR_NOT_STARTED,
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

describe('[IDN-169] ConfirmTwoFactorSetupUseCase', () => {
  const started = (): User => {
    const user = makeUser();
    user.startTwoFactorSetup('enc:SECRET');
    return user;
  };

  const build = (user = started()) => {
    const repo = makeUserRepo([user]);
    const tokens = makeTokens();
    const codes = makeCodes();
    const useCase = new ConfirmTwoFactorSetupUseCase(
      repo,
      new SignInSteps(repo, tokens),
      codes,
      makeRecoveryCodes(),
      makeCipher(),
      makeLogger()
    );
    const confirm = (code = GOOD_CODE) =>
      useCase.execute({
        challengeToken: challengeFor(user, 'two-factor-setup'),
        code,
        sourceIp: '203.0.113.7'
      });
    return { user, repo, tokens, codes, confirm };
  };

  it('turns two-factor on and signs in with the recovery codes', async () => {
    const { user, repo, confirm } = build();

    const result = await confirm();

    expect(result.value).toEqual({
      token: 'session.jwt',
      user: {
        id: user.id.toString(),
        email: 'staff@isp.example',
        role: 'OPERATOR'
      },
      recoveryCodes: ['AAAAA-BBBBB', 'CCCCC-DDDDD']
    });
    expect(user.hasTwoFactor).toBe(true);
    expect(user.twoFactorLastStep).toBe(GOOD_STEP);
    expect(user.recoveryCodeHashes).toEqual([
      'h:AAAAABBBBB',
      'h:CCCCCDDDDD'
    ]);
    expect(repo.save).toHaveBeenCalledWith(user);
  });

  it('checks the code against the decrypted secret', async () => {
    const { codes, confirm } = build();

    await confirm();

    expect(codes.matchStep).toHaveBeenCalledWith(
      'SECRET',
      GOOD_CODE,
      expect.any(Date)
    );
  });

  it('[IDN-044] counts a wrong code and leaves two-factor off', async () => {
    const { user, repo, tokens, confirm } = build();

    const result = await confirm('000000');

    expect(result.error).toBe(INVALID_CODE);
    expect(user.failedSignIns).toBe(1);
    expect(user.hasTwoFactor).toBe(false);
    expect(repo.save).toHaveBeenCalledWith(user);
    expect(tokens.sign).not.toHaveBeenCalled();
  });

  it('[IDN-044] clears the count once the code is right', async () => {
    const user = started();
    user.recordFailedSignIn(new Date(), null);
    const { confirm } = build(user);

    await confirm();

    expect(user.failedSignIns).toBe(0);
  });

  it('[IDN-044] refuses during a pause without checking the code', async () => {
    const user = started();
    for (let i = 0; i < 5; i++)
      user.recordFailedSignIn(new Date(), null);
    const { codes, confirm } = build(user);

    const result = await confirm();

    expect(result.error).toBe(SIGN_IN_PAUSED);
    expect(codes.matchStep).not.toHaveBeenCalled();
  });

  it('refuses before the setup was started', async () => {
    const { confirm } = build(makeUser());

    expect((await confirm()).error).toBe(TWO_FACTOR_NOT_STARTED);
  });

  it('[IDN-165] refuses when two-factor is already on', async () => {
    const { confirm } = build(withTwoFactor(makeUser()));

    expect((await confirm()).error).toBe(TWO_FACTOR_ALREADY_ON);
  });

  it('[IDN-167] refuses a code challenge', async () => {
    const { user, repo } = build();
    const useCase = new ConfirmTwoFactorSetupUseCase(
      repo,
      new SignInSteps(repo, makeTokens()),
      makeCodes(),
      makeRecoveryCodes(),
      makeCipher(),
      makeLogger()
    );

    const result = await useCase.execute({
      challengeToken: challengeFor(user, 'two-factor'),
      code: GOOD_CODE,
      sourceIp: null
    });

    expect(result.error).toBe(SIGN_IN_STEP_EXPIRED);
  });

  it('gives no session when two-factor cannot be saved', async () => {
    const { repo, tokens, confirm } = build();
    repo.save.mockResolvedValue(Result.fail('db down'));

    const result = await confirm();

    expect(result.isFailure).toBe(true);
    expect(tokens.sign).not.toHaveBeenCalled();
  });
});
