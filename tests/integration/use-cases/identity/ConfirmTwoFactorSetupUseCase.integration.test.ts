import { PrismaClient } from '../../../../src/generated/prisma/client';
import { ConfirmTwoFactorSetupUseCase } from 'application/identity/use-cases/ConfirmTwoFactorSetupUseCase';
import { INVALID_CODE } from 'application/identity/services/SignInSteps';
import { TWO_FACTOR_NOT_STARTED } from 'domain/identity';
import { CredentialsEncryption } from 'infrastructure/crypto';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import { cleanDatabase } from '../../helpers/db';
import { appCode } from '../../helpers/auth';
import { makeAdapters } from './shared';

const EMAIL = 'staff@isp.example';

describe('[IDN-169] ConfirmTwoFactorSetupUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let adapters: ReturnType<typeof makeAdapters>;
  let useCase: ConfirmTwoFactorSetupUseCase;
  let userId: string;
  let secret: string;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();
    adapters = makeAdapters(prisma);
    useCase = new ConfirmTwoFactorSetupUseCase(
      adapters.users,
      adapters.signInSteps,
      adapters.twoFactorCodes,
      adapters.recoveryCodes,
      adapters.cipher,
      adapters.newSignInWarning,
      adapters.logger
    );
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    secret = adapters.twoFactorCodes.generateSecret();
    ({ id: userId } = await prisma.user.create({
      data: {
        email: EMAIL,
        passwordHash: 'x',
        role: 'OPERATOR',
        twoFactorSecret: CredentialsEncryption.encrypt(secret)
      }
    }));
  });

  const confirm = (code: string) =>
    useCase.execute({
      challengeToken: adapters.tokens.signChallenge({
        userId,
        tokenVersion: 0,
        kind: 'two-factor-setup'
      }),
      code,
      rememberBrowser: false,
      sourceIp: '203.0.113.7'
    });

  const row = () =>
    prisma.user.findUniqueOrThrow({ where: { id: userId } });

  it('stores two-factor on, the step used and only the hashes of the recovery codes', async () => {
    const result = await confirm(appCode(secret));

    expect(result.value.recoveryCodes).toHaveLength(10);
    const stored = await row();
    expect(stored.twoFactorEnabledAt).not.toBeNull();
    expect(stored.twoFactorLastStep).toBeGreaterThan(0);
    expect(stored.recoveryCodeHashes).toEqual(
      result.value.recoveryCodes.map((c) =>
        adapters.recoveryCodes.hash(c)
      )
    );
  });

  it('the session it returns is accepted by the session check', async () => {
    const result = await confirm(appCode(secret));

    const payload = adapters.tokens.verify(result.value.token);
    expect(payload.value.userId).toBe(userId);
  });

  it('[IDN-044] stores a wrong code as a failed sign-in', async () => {
    const result = await confirm('000000');

    expect(result.error).toBe(INVALID_CODE);
    expect(await row()).toMatchObject({
      failedSignIns: 1,
      twoFactorEnabledAt: null
    });
  });

  it('[IDN-044] clears the count once the code is right', async () => {
    await confirm('000000');

    await confirm(appCode(secret));

    expect((await row()).failedSignIns).toBe(0);
  });

  it('refuses when no setup was started', async () => {
    await prisma.user.update({
      where: { id: userId },
      data: { twoFactorSecret: null }
    });

    expect((await confirm('123456')).error).toBe(
      TWO_FACTOR_NOT_STARTED
    );
  });
});
