import bcrypt from 'bcrypt';
import { PrismaClient } from '../../../../src/generated/prisma/client';
import { CreateUserUseCase } from 'application/identity';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import { cleanDatabase } from '../../helpers/db';
import { makeAdapters } from './shared';

describe('CreateUserUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: CreateUserUseCase;
  let adapters: ReturnType<typeof makeAdapters>;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();
    adapters = makeAdapters(prisma);
    useCase = new CreateUserUseCase(
      adapters.users,
      adapters.passwords,
      adapters.tokens,
      adapters.emails,
      'https://app.isp.example',
      adapters.logger
    );
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    adapters.emails.sent = [];
    adapters.emails.failWith = null;
  });

  it('[IDN-184] an invitation saves an account whose link sets the password', async () => {
    const result = await useCase.execute({
      email: 'new@isp.example',
      password: null,
      role: 'OPERATOR'
    });

    expect(result.isSuccess).toBe(true);
    const row = await prisma.user.findUniqueOrThrow({
      where: { email: 'new@isp.example' }
    });
    expect(row.passwordHash).toMatch(/^\$2[aby]\$10\$/);
    const token = adapters.emails.sent[0].text.match(
      /accept-invitation#token=(\S+)/
    )![1];
    expect(
      adapters.tokens.verifyChallenge(token, 'invitation').value
    ).toEqual({
      userId: row.id,
      tokenVersion: 0,
      kind: 'invitation'
    });
  });

  it('[IDN-184] an invitation that cannot be sent saves nothing', async () => {
    adapters.emails.failWith = 'smtp down';

    const result = await useCase.execute({
      email: 'new@isp.example',
      password: null,
      role: 'OPERATOR'
    });

    expect(result.isFailure).toBe(true);
    expect(await prisma.user.count()).toBe(0);
  });

  it('[IDN-140] stores an enabled account with a bcrypt hash', async () => {
    await useCase.execute({
      email: 'new@isp.example',
      password: 'new-password',
      role: 'OPERATOR'
    });

    const row = await prisma.user.findUniqueOrThrow({
      where: { email: 'new@isp.example' }
    });
    expect(row).toMatchObject({
      role: 'OPERATOR',
      disabledAt: null,
      tokenVersion: 0
    });
    expect(
      await bcrypt.compare('new-password', row.passwordHash)
    ).toBe(true);
  });

  it('[IDN-004] refuses a second account with the same email, any case', async () => {
    const request = {
      email: 'new@isp.example',
      password: 'new-password',
      role: 'VIEWER'
    };
    await useCase.execute(request);

    const result = await useCase.execute({
      ...request,
      email: 'NEW@isp.example'
    });

    expect(result.error).toBe(
      'A user with this email already exists'
    );
    expect(await prisma.user.count()).toBe(1);
  });

  it('[IDN-141] creates nothing for the VENDOR role', async () => {
    await useCase.execute({
      email: 'new@isp.example',
      password: 'new-password',
      role: 'VENDOR'
    });

    expect(await prisma.user.count()).toBe(0);
  });
});
