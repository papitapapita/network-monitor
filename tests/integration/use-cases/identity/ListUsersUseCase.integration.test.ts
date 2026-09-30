import { PrismaClient } from '../../../../src/generated/prisma/client';
import { ListUsersUseCase } from 'application/identity';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import { cleanDatabase } from '../../helpers/db';
import { seedUser } from '../../helpers/auth';
import { makeAdapters } from './shared';

describe('ListUsersUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: ListUsersUseCase;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();
    const { users, logger } = makeAdapters(prisma);
    useCase = new ListUsersUseCase(users, logger);
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
  });

  it('[IDN-140] lists oldest first, the vendor only for the vendor', async () => {
    await seedUser(
      prisma,
      'first@isp.example',
      'password-1',
      'ADMIN'
    );
    await seedUser(
      prisma,
      'vendor@nms.example',
      'password-2',
      'VENDOR'
    );
    await seedUser(
      prisma,
      'third@isp.example',
      'password-3',
      'VIEWER'
    );

    const customer = await useCase.execute({ callerRole: 'ADMIN' });
    const vendor = await useCase.execute({ callerRole: 'VENDOR' });

    expect(customer.value.users.map((u) => u.email)).toEqual([
      'first@isp.example',
      'third@isp.example'
    ]);
    expect(vendor.value.users).toHaveLength(3);
  });

  it('[IDN-013] reports a disabled account', async () => {
    await seedUser(
      prisma,
      'gone@isp.example',
      'password-1',
      'VIEWER'
    );
    await prisma.user.update({
      where: { email: 'gone@isp.example' },
      data: { disabledAt: new Date() }
    });

    const [user] = (await useCase.execute({ callerRole: 'ADMIN' }))
      .value.users;

    expect(user.disabled).toBe(true);
  });
});
