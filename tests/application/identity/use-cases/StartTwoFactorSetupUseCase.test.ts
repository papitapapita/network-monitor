import { StartTwoFactorSetupUseCase } from '../../../../src/application/identity/use-cases/StartTwoFactorSetupUseCase';
import {
  SIGN_IN_STEP_EXPIRED,
  SignInSteps
} from '../../../../src/application/identity/services/SignInSteps';
import { TWO_FACTOR_ALREADY_ON } from '../../../../src/domain/identity/aggregates/User';
import { Result } from '../../../../src/domain/shared/core/Result';
import { makeLogger } from '../../probe-agents/fixtures';
import { makeUser, makeUserRepo } from './userFixtures';
import {
  challengeFor,
  makeCipher,
  makeCodes,
  makeTokens,
  withTwoFactor
} from './twoFactorFakes';

describe('[IDN-168] StartTwoFactorSetupUseCase', () => {
  const build = (user = makeUser()) => {
    const repo = makeUserRepo([user]);
    const logger = makeLogger();
    const useCase = new StartTwoFactorSetupUseCase(
      repo,
      new SignInSteps(repo, makeTokens()),
      makeCodes(),
      makeCipher(),
      logger
    );
    return { user, repo, logger, useCase };
  };

  it('stores the new secret encrypted and returns it with the app link', async () => {
    const { user, repo, useCase } = build();

    const result = await useCase.execute({
      challengeToken: challengeFor(user, 'two-factor-setup')
    });

    expect(result.value).toEqual({
      secret: 'NEWSECRET',
      otpauthUri:
        'otpauth://totp/Mi Red Control:staff@isp.example?secret=NEWSECRET'
    });
    expect(user.twoFactorSecret).toBe('enc:NEWSECRET');
    expect(user.hasTwoFactor).toBe(false);
    expect(repo.save).toHaveBeenCalledWith(user);
  });

  it('[IDN-167] refuses a code challenge', async () => {
    const { user, useCase } = build();

    const result = await useCase.execute({
      challengeToken: challengeFor(user, 'two-factor')
    });

    expect(result.error).toBe(SIGN_IN_STEP_EXPIRED);
  });

  it('[IDN-167] refuses a challenge from before the sessions were ended', async () => {
    const { user, useCase } = build();

    const result = await useCase.execute({
      challengeToken: challengeFor(user, 'two-factor-setup', 7)
    });

    expect(result.error).toBe(SIGN_IN_STEP_EXPIRED);
  });

  it('[IDN-167] refuses a disabled account', async () => {
    const { user, useCase } = build();
    user.disable();

    const result = await useCase.execute({
      challengeToken: challengeFor(user, 'two-factor-setup')
    });

    expect(result.error).toBe(SIGN_IN_STEP_EXPIRED);
  });

  it('[IDN-165] never replaces a working setup', async () => {
    const { user, repo, useCase } = build(withTwoFactor(makeUser()));

    const result = await useCase.execute({
      challengeToken: challengeFor(user, 'two-factor-setup')
    });

    expect(result.error).toBe(TWO_FACTOR_ALREADY_ON);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('fails when the secret cannot be saved', async () => {
    const { user, repo, useCase } = build();
    repo.save.mockResolvedValue(Result.fail('db down'));

    const result = await useCase.execute({
      challengeToken: challengeFor(user, 'two-factor-setup')
    });

    expect(result.isFailure).toBe(true);
  });

  it('keeps the challenge out of the logs', async () => {
    const { user, logger, useCase } = build();
    const token = challengeFor(user, 'two-factor-setup');

    await useCase.execute({ challengeToken: token });

    expect(JSON.stringify(logger.info.mock.calls)).not.toContain(
      token
    );
  });
});
