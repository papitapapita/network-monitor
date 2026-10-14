// Source: src/application/identity/use-cases/UnlockCredentialRevealUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import {
  UnlockCredentialRevealUseCase,
  WRONG_PASSWORD
} from 'application/identity';
import { SIGN_IN_PAUSED } from 'domain/identity';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import { cleanDatabase, GHOST_ID } from '../../helpers/db';
import { seedUser } from '../../helpers/auth';
import { makeAdapters } from './shared';

describe('UnlockCredentialRevealUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: UnlockCredentialRevealUseCase;
  let tokens: ReturnType<typeof makeAdapters>['tokens'];
  let userId: string;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();
    const adapters = makeAdapters(prisma);
    tokens = adapters.tokens;
    useCase = new UnlockCredentialRevealUseCase(
      adapters.users,
      adapters.passwords,
      adapters.tokens,
      adapters.signInSteps,
      adapters.logger
    );
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    await seedUser(
      prisma,
      'tech@isp.example',
      'tech-password',
      'OPERATOR'
    );
    userId = (await row()).id;
  });

  const row = () =>
    prisma.user.findUniqueOrThrow({
      where: { email: 'tech@isp.example' }
    });

  const unlock = (password: string, id = userId) =>
    useCase.execute({ userId: id, password, sourceIp: '10.0.0.9' });

  it('[IDN-086] signs an unlock bound to the account and its version', async () => {
    const result = await unlock('tech-password');

    expect(result.value.expiresInSeconds).toBe(300);
    expect(
      tokens.verifyChallenge(
        result.value.revealToken,
        'credential-reveal'
      ).value
    ).toEqual({
      userId,
      tokenVersion: 0,
      kind: 'credential-reveal'
    });
  });

  it('[IDN-044] stores each wrong password on the account', async () => {
    const result = await unlock('guess');

    expect(result.error).toBe(WRONG_PASSWORD);
    expect((await row()).failedSignIns).toBe(1);
  });

  it('[IDN-044] five wrong passwords pause the account', async () => {
    for (let i = 0; i < 5; i++) await unlock('guess');

    const result = await unlock('tech-password');

    expect(result.error).toBe(SIGN_IN_PAUSED);
    expect((await row()).signInPausedUntil).not.toBeNull();
  });

  it('refuses a disabled account', async () => {
    await prisma.user.update({
      where: { id: userId },
      data: { disabledAt: new Date() }
    });

    const result = await unlock('tech-password');

    expect(result.error).toMatch(/User not found/);
  });

  it('fails for an account that does not exist', async () => {
    const result = await unlock('tech-password', GHOST_ID);

    expect(result.error).toMatch(/User not found/);
  });

  it('fails with a malformed user id', async () => {
    const result = await unlock('tech-password', 'not-a-uuid');

    expect(result.error).toMatch(/Invalid user ID/);
  });
});
