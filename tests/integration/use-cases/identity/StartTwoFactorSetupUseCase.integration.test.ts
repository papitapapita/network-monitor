import { PrismaClient } from '../../../../src/generated/prisma/client';
import { StartTwoFactorSetupUseCase } from 'application/identity/use-cases/StartTwoFactorSetupUseCase';
import { SIGN_IN_STEP_EXPIRED } from 'application/identity/services/SignInSteps';
import { ChallengeKind } from 'application/identity/interfaces/ITokenService';
import { CredentialsEncryption } from 'infrastructure/crypto';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import { cleanDatabase } from '../../helpers/db';
import { makeAdapters } from './shared';

const EMAIL = 'staff@isp.example';

describe('[IDN-168] StartTwoFactorSetupUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let adapters: ReturnType<typeof makeAdapters>;
  let useCase: StartTwoFactorSetupUseCase;
  let userId: string;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();
    adapters = makeAdapters(prisma);
    useCase = new StartTwoFactorSetupUseCase(
      adapters.users,
      adapters.signInSteps,
      adapters.twoFactorCodes,
      adapters.cipher,
      adapters.logger
    );
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    ({ id: userId } = await prisma.user.create({
      data: { email: EMAIL, passwordHash: 'x', role: 'OPERATOR' }
    }));
  });

  const challenge = (
    kind: ChallengeKind = 'two-factor-setup',
    tokenVersion = 0
  ) => adapters.tokens.signChallenge({ userId, tokenVersion, kind });

  const row = () =>
    prisma.user.findUniqueOrThrow({ where: { id: userId } });

  it('stores the secret encrypted, with two-factor still off', async () => {
    const result = await useCase.execute({
      challengeToken: challenge()
    });

    const { twoFactorSecret, twoFactorEnabledAt } = await row();
    expect(twoFactorSecret).not.toBe(result.value.secret);
    expect(CredentialsEncryption.decrypt(twoFactorSecret!)).toBe(
      result.value.secret
    );
    expect(twoFactorEnabledAt).toBeNull();
    expect(result.value.otpauthUri).toContain(
      encodeURIComponent(`Mi Red Control:${EMAIL}`)
    );
  });

  it('a second start replaces an unfinished setup', async () => {
    const first = await useCase.execute({
      challengeToken: challenge()
    });
    const second = await useCase.execute({
      challengeToken: challenge()
    });

    expect(second.value.secret).not.toBe(first.value.secret);
    expect(
      CredentialsEncryption.decrypt((await row()).twoFactorSecret!)
    ).toBe(second.value.secret);
  });

  it('[IDN-167] refuses a challenge older than the sessions', async () => {
    await prisma.user.update({
      where: { id: userId },
      data: { tokenVersion: 1 }
    });

    const result = await useCase.execute({
      challengeToken: challenge()
    });

    expect(result.error).toBe(SIGN_IN_STEP_EXPIRED);
    expect((await row()).twoFactorSecret).toBeNull();
  });

  it('[IDN-167] refuses a session token', async () => {
    const session = adapters.tokens.sign({
      userId,
      email: EMAIL,
      role: 'OPERATOR',
      tokenVersion: 0
    });

    const result = await useCase.execute({ challengeToken: session });

    expect(result.error).toBe(SIGN_IN_STEP_EXPIRED);
  });

  it('[IDN-167] refuses a malformed token', async () => {
    const result = await useCase.execute({
      challengeToken: 'nonsense'
    });

    expect(result.error).toBe(SIGN_IN_STEP_EXPIRED);
  });
});
