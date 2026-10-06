import bcrypt from 'bcrypt';
import { PrismaClient } from '../../../../src/generated/prisma/client';
import { LoginUseCase } from 'application/identity/use-cases/LoginUseCase';
import { SIGN_IN_PAUSED } from 'domain/identity';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import { cleanDatabase } from '../../helpers/db';
import { makeAdapters } from './shared';

const EMAIL = 'staff@isp.example';
const PASSWORD = 'right-password';

describe('LoginUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: LoginUseCase;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();
    const { users, passwords, signInSteps, logger } =
      makeAdapters(prisma);
    useCase = new LoginUseCase(users, passwords, signInSteps, logger);
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    await prisma.user.create({
      data: {
        email: EMAIL,
        passwordHash: await bcrypt.hash(PASSWORD, 4),
        role: 'OPERATOR'
      }
    });
  });

  const signIn = (password: string) =>
    useCase.execute({
      email: EMAIL,
      password,
      sourceIp: '203.0.113.7'
    });

  const row = () =>
    prisma.user.findUniqueOrThrow({ where: { email: EMAIL } });

  it('[IDN-166] the right password opens two-factor setup', async () => {
    const result = await signIn(PASSWORD);

    expect(result.value.twoFactor).toBe('setup');
  });

  it('[IDN-044] the right password leaves the count for the code to clear', async () => {
    await signIn('wrong');

    await signIn(PASSWORD);

    expect((await row()).failedSignIns).toBe(1);
  });

  it('[IDN-044] stores each wrong password', async () => {
    await signIn('wrong');
    await signIn('wrong');

    expect((await row()).failedSignIns).toBe(2);
  });

  it('[IDN-044] stores a one-minute pause on the fifth wrong password', async () => {
    const before = Date.now();
    for (let i = 0; i < 5; i++) await signIn('wrong');

    const { failedSignIns, signInPausedUntil } = await row();
    expect(failedSignIns).toBe(5);
    expect(signInPausedUntil!.getTime()).toBeGreaterThanOrEqual(
      before + 60_000
    );
    expect(signInPausedUntil!.getTime()).toBeLessThan(
      Date.now() + 61_000
    );
  });

  it('[IDN-044] refuses even the right password during the pause', async () => {
    for (let i = 0; i < 5; i++) await signIn('wrong');

    const result = await signIn(PASSWORD);

    expect(result.error).toBe(SIGN_IN_PAUSED);
  });

  it('[IDN-044] accepts the right password once the pause ends', async () => {
    for (let i = 0; i < 5; i++) await signIn('wrong');
    await prisma.user.update({
      where: { email: EMAIL },
      data: { signInPausedUntil: new Date(Date.now() - 1) }
    });

    const result = await signIn(PASSWORD);

    expect(result.isSuccess).toBe(true);
  });

  it('[IDN-044] the database refuses a pause before five failures', async () => {
    await expect(
      prisma.user.update({
        where: { email: EMAIL },
        data: { failedSignIns: 2, signInPausedUntil: new Date() }
      })
    ).rejects.toThrow();
  });

  it('[IDN-160] the database refuses two-factor on without a secret, or recovery codes while off', async () => {
    await expect(
      prisma.user.update({
        where: { email: EMAIL },
        data: { twoFactorEnabledAt: new Date() }
      })
    ).rejects.toThrow();
    await expect(
      prisma.user.update({
        where: { email: EMAIL },
        data: { twoFactorSecret: 'x', recoveryCodeHashes: ['h'] }
      })
    ).rejects.toThrow();
  });
});
