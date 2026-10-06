import { PrismaClient } from '../../../../src/generated/prisma/client';
import {
  ADMIN_RESET_NEEDS_VENDOR,
  ResetTwoFactorUseCase
} from 'application/identity';
import { CredentialsEncryption } from 'infrastructure/crypto';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import {
  cleanDatabase,
  GHOST_ID,
  INVALID_ID
} from '../../helpers/db';
import { makeAdapters } from './shared';

describe('[IDN-172] ResetTwoFactorUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: ResetTwoFactorUseCase;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();
    const { users, logger } = makeAdapters(prisma);
    useCase = new ResetTwoFactorUseCase(users, logger);
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
  });

  const seedEnrolled = async (role: 'OPERATOR' | 'ADMIN') =>
    (
      await prisma.user.create({
        data: {
          email: `${role.toLowerCase()}@isp.example`,
          passwordHash: 'x',
          role,
          twoFactorSecret: CredentialsEncryption.encrypt('SECRET'),
          twoFactorEnabledAt: new Date(),
          twoFactorLastStep: 7,
          recoveryCodeHashes: ['h1', 'h2']
        }
      })
    ).id;

  const reset = (id: string, callerRole = 'ADMIN') =>
    useCase.execute({
      id,
      callerRole,
      callerEmail: 'boss@isp.example'
    });

  it('clears the two-factor columns and ends the sessions', async () => {
    const id = await seedEnrolled('OPERATOR');

    const result = await reset(id);

    expect(result.value.twoFactorEnabled).toBe(false);
    const row = await prisma.user.findUniqueOrThrow({
      where: { id }
    });
    expect(row).toMatchObject({
      twoFactorSecret: null,
      twoFactorEnabledAt: null,
      twoFactorLastStep: null,
      recoveryCodeHashes: [],
      tokenVersion: 1
    });
  });

  it('leaves an administrator alone unless the vendor asks', async () => {
    const id = await seedEnrolled('ADMIN');

    const result = await reset(id, 'ADMIN');

    expect(result.error).toBe(ADMIN_RESET_NEEDS_VENDOR);
    const row = await prisma.user.findUniqueOrThrow({
      where: { id }
    });
    expect(row.twoFactorEnabledAt).not.toBeNull();
  });

  it('refuses an unknown user', async () => {
    expect((await reset(GHOST_ID)).error).toMatch(/not found/);
  });

  it('refuses a malformed id', async () => {
    expect((await reset(INVALID_ID)).error).toMatch(
      /Invalid user ID/
    );
  });
});
