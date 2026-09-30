import { PrismaClient } from '../../../../src/generated/prisma/client';
import {
  UpdateUserUseCase,
  VENDOR_ACCOUNT_PROTECTED
} from 'application/identity';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import {
  cleanDatabase,
  GHOST_ID,
  INVALID_ID
} from '../../helpers/db';
import { seedUser } from '../../helpers/auth';
import { makeAdapters } from './shared';

describe('UpdateUserUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: UpdateUserUseCase;
  let callerId: string;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();
    const { users, passwords, logger } = makeAdapters(prisma);
    useCase = new UpdateUserUseCase(users, passwords, logger);
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    await seedUser(
      prisma,
      'admin@isp.example',
      'password-1',
      'ADMIN'
    );
    callerId = (await row('admin@isp.example')).id;
  });

  const row = (email: string) =>
    prisma.user.findUniqueOrThrow({ where: { email } });

  it('[IDN-065] persists the change and the bumped token version', async () => {
    await seedUser(
      prisma,
      'staff@isp.example',
      'password-1',
      'OPERATOR'
    );
    const { id } = await row('staff@isp.example');

    await useCase.execute({
      id,
      callerId,
      role: 'VIEWER',
      disabled: true
    });

    expect(await row('staff@isp.example')).toMatchObject({
      role: 'VIEWER',
      disabledAt: expect.any(Date),
      tokenVersion: 2
    });
  });

  it('[IDN-141] leaves the vendor account untouched', async () => {
    await seedUser(
      prisma,
      'vendor@nms.example',
      'password-1',
      'VENDOR'
    );
    const before = await row('vendor@nms.example');

    const result = await useCase.execute({
      id: before.id,
      callerId,
      disabled: true
    });

    expect(result.error).toBe(VENDOR_ACCOUNT_PROTECTED);
    expect(await row('vendor@nms.example')).toEqual(before);
  });

  it('fails for an unknown user', async () => {
    expect(
      (
        await useCase.execute({
          id: GHOST_ID,
          callerId,
          disabled: true
        })
      ).error
    ).toContain('not found');
  });

  it('fails on a malformed id', async () => {
    expect(
      (
        await useCase.execute({
          id: INVALID_ID,
          callerId,
          disabled: true
        })
      ).error
    ).toContain('Invalid user ID');
  });
});
