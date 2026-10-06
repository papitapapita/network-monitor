import { PrismaClient } from '../../../../src/generated/prisma/client';
import { VerifyTwoFactorUseCase } from 'application/identity/use-cases/VerifyTwoFactorUseCase';
import {
  INVALID_CODE,
  SIGN_IN_STEP_EXPIRED
} from 'application/identity/services/SignInSteps';
import { SIGN_IN_PAUSED } from 'domain/identity';
import { CredentialsEncryption } from 'infrastructure/crypto';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import { cleanDatabase } from '../../helpers/db';
import { appCode } from '../../helpers/auth';
import { makeAdapters } from './shared';

const EMAIL = 'staff@isp.example';
const RECOVERY = 'ABCDE-FGHJK';

describe('[IDN-170] VerifyTwoFactorUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let adapters: ReturnType<typeof makeAdapters>;
  let useCase: VerifyTwoFactorUseCase;
  let userId: string;
  let secret: string;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();
    adapters = makeAdapters(prisma);
    useCase = new VerifyTwoFactorUseCase(
      adapters.users,
      adapters.signInSteps,
      adapters.twoFactorCodes,
      adapters.recoveryCodes,
      adapters.cipher,
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
        twoFactorSecret: CredentialsEncryption.encrypt(secret),
        twoFactorEnabledAt: new Date(),
        recoveryCodeHashes: [adapters.recoveryCodes.hash(RECOVERY)]
      }
    }));
  });

  const verify = (answer: { code?: string; recoveryCode?: string }) =>
    useCase.execute({
      challengeToken: adapters.tokens.signChallenge({
        userId,
        tokenVersion: 0,
        kind: 'two-factor'
      }),
      code: answer.code ?? null,
      recoveryCode: answer.recoveryCode ?? null,
      rememberBrowser: false,
      sourceIp: '203.0.113.7'
    });

  const row = () =>
    prisma.user.findUniqueOrThrow({ where: { id: userId } });

  it('signs in with the app code and stores its step', async () => {
    const result = await verify({ code: appCode(secret) });

    expect(result.isSuccess).toBe(true);
    expect((await row()).twoFactorLastStep).toBe(
      Math.floor(Date.now() / 30_000)
    );
  });

  it('[IDN-164] the same code is refused the second time, across requests', async () => {
    const code = appCode(secret);
    await verify({ code });

    const result = await verify({ code });

    expect(result.error).toBe(INVALID_CODE);
    expect((await row()).failedSignIns).toBe(1);
  });

  it('[IDN-164] an older code is refused after a newer one', async () => {
    await verify({ code: appCode(secret) });

    const result = await verify({ code: appCode(secret, -1) });

    expect(result.error).toBe(INVALID_CODE);
  });

  it('[IDN-163] a recovery code works once and is removed', async () => {
    const first = await verify({
      recoveryCode: RECOVERY.toLowerCase()
    });
    const second = await verify({ recoveryCode: RECOVERY });

    expect(first.isSuccess).toBe(true);
    expect(second.error).toBe(INVALID_CODE);
    expect((await row()).recoveryCodeHashes).toEqual([]);
  });

  it('[IDN-044] five wrong codes pause the account, even for the right one', async () => {
    for (let i = 0; i < 5; i++) await verify({ code: '000000' });

    const result = await verify({ code: appCode(secret) });

    expect(result.error).toBe(SIGN_IN_PAUSED);
    expect((await row()).signInPausedUntil).not.toBeNull();
  });

  it('[IDN-167] refuses once the sessions were ended', async () => {
    await prisma.user.update({
      where: { id: userId },
      data: { tokenVersion: 1 }
    });

    const result = await verify({ code: appCode(secret) });

    expect(result.error).toBe(SIGN_IN_STEP_EXPIRED);
  });

  it('[IDN-167] refuses a disabled account', async () => {
    await prisma.user.update({
      where: { id: userId },
      data: { disabledAt: new Date() }
    });

    const result = await verify({ code: appCode(secret) });

    expect(result.error).toBe(SIGN_IN_STEP_EXPIRED);
  });
});
