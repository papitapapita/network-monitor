import { PrismaClient } from '../../../../src/generated/prisma/client';
import { RequestPasswordResetUseCase } from 'application/identity/use-cases/RequestPasswordResetUseCase';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import { cleanDatabase } from '../../helpers/db';
import { seedUser } from '../../helpers/auth';
import { makeAdapters } from './shared';

describe('[IDN-182] RequestPasswordResetUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let adapters: ReturnType<typeof makeAdapters>;
  let useCase: RequestPasswordResetUseCase;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();
    adapters = makeAdapters(prisma);
    useCase = new RequestPasswordResetUseCase(
      adapters.users,
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
  });

  it('emails a link whose token the reset accepts', async () => {
    await seedUser(
      prisma,
      'me@isp.example',
      'old-password',
      'VIEWER'
    );
    const row = await prisma.user.findUniqueOrThrow({
      where: { email: 'me@isp.example' }
    });

    const result = await useCase.execute({ email: 'ME@isp.example' });

    expect(result.isSuccess).toBe(true);
    expect(adapters.emails.sent).toHaveLength(1);
    const token = adapters.emails.sent[0].text.match(
      /reset-password#token=(\S+)/
    )![1];
    const verified = adapters.tokens.verifyChallenge(
      token,
      'password-reset'
    );
    expect(verified.value).toEqual({
      userId: row.id,
      tokenVersion: row.tokenVersion,
      kind: 'password-reset'
    });
  });

  it('sends nothing for an address with no account', async () => {
    const result = await useCase.execute({
      email: 'nobody@isp.example'
    });

    expect(result.isSuccess).toBe(true);
    expect(adapters.emails.sent).toEqual([]);
  });

  it('sends nothing to a disabled account', async () => {
    await seedUser(
      prisma,
      'me@isp.example',
      'old-password',
      'VIEWER'
    );
    await prisma.user.update({
      where: { email: 'me@isp.example' },
      data: { disabledAt: new Date() }
    });

    await useCase.execute({ email: 'me@isp.example' });

    expect(adapters.emails.sent).toEqual([]);
  });
});
