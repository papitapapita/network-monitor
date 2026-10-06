import bcrypt from 'bcrypt';
import { PrismaClient } from '../../../../src/generated/prisma/client';
import {
  RESET_LINK_EXPIRED,
  ResetPasswordUseCase
} from 'application/identity/use-cases/ResetPasswordUseCase';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import { cleanDatabase } from '../../helpers/db';
import { seedUser } from '../../helpers/auth';
import { makeAdapters } from './shared';

describe('[IDN-183] ResetPasswordUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let adapters: ReturnType<typeof makeAdapters>;
  let useCase: ResetPasswordUseCase;
  let userId: string;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();
    adapters = makeAdapters(prisma);
    useCase = new ResetPasswordUseCase(
      adapters.users,
      adapters.passwords,
      adapters.tokens,
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
      'me@isp.example',
      'old-password',
      'VIEWER'
    );
    ({ id: userId } = await prisma.user.update({
      where: { email: 'me@isp.example' },
      data: {
        failedSignIns: 5,
        signInPausedUntil: new Date(Date.now() + 60_000)
      }
    }));
  });

  const link = (tokenVersion = 0) =>
    adapters.tokens.signChallenge({
      userId,
      tokenVersion,
      kind: 'password-reset'
    });

  const row = () =>
    prisma.user.findUniqueOrThrow({ where: { id: userId } });

  it('stores the new hash, ends the sessions and lifts the pause', async () => {
    const result = await useCase.execute({
      token: link(),
      password: 'a-brand-new-password'
    });

    expect(result.isSuccess).toBe(true);
    const saved = await row();
    expect(
      await bcrypt.compare('a-brand-new-password', saved.passwordHash)
    ).toBe(true);
    expect(saved.tokenVersion).toBe(1);
    expect(saved.failedSignIns).toBe(0);
    expect(saved.signInPausedUntil).toBeNull();
  });

  it('refuses the same link a second time', async () => {
    const token = link();
    await useCase.execute({
      token,
      password: 'a-brand-new-password'
    });

    const again = await useCase.execute({
      token,
      password: 'another-new-password'
    });

    expect(again.error).toBe(RESET_LINK_EXPIRED);
  });

  it('refuses a link from before the sessions were ended', async () => {
    await prisma.user.update({
      where: { id: userId },
      data: { tokenVersion: 2 }
    });

    const result = await useCase.execute({
      token: link(1),
      password: 'a-brand-new-password'
    });

    expect(result.error).toBe(RESET_LINK_EXPIRED);
  });
});
