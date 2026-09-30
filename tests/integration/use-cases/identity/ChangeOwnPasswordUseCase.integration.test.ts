import bcrypt from 'bcrypt';
import { PrismaClient } from '../../../../src/generated/prisma/client';
import {
  ChangeOwnPasswordUseCase,
  WRONG_CURRENT_PASSWORD
} from 'application/identity';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import { cleanDatabase } from '../../helpers/db';
import { seedUser } from '../../helpers/auth';
import { makeAdapters } from './shared';

describe('ChangeOwnPasswordUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: ChangeOwnPasswordUseCase;
  let tokens: ReturnType<typeof makeAdapters>['tokens'];
  let userId: string;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();
    const adapters = makeAdapters(prisma);
    tokens = adapters.tokens;
    useCase = new ChangeOwnPasswordUseCase(
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
    userId = (await row()).id;
  });

  const row = () =>
    prisma.user.findUniqueOrThrow({
      where: { email: 'me@isp.example' }
    });

  it('[IDN-144] stores the new password and signs the new version', async () => {
    const result = await useCase.execute({
      userId,
      currentPassword: 'old-password',
      newPassword: 'new-password'
    });

    const user = await row();
    expect(
      await bcrypt.compare('new-password', user.passwordHash)
    ).toBe(true);
    expect(tokens.verify(result.value.token).value.tokenVersion).toBe(
      user.tokenVersion
    );
    expect(user.tokenVersion).toBe(1);
  });

  it('[IDN-144] keeps the password on a wrong current one', async () => {
    const before = await row();

    const result = await useCase.execute({
      userId,
      currentPassword: 'guess',
      newPassword: 'new-password'
    });

    expect(result.error).toBe(WRONG_CURRENT_PASSWORD);
    expect((await row()).passwordHash).toBe(before.passwordHash);
  });
});
