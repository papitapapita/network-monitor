import { PrismaClient } from '../../../../src/generated/prisma/client';
import { GetAgentUseCase } from 'application/probe-agents/use-cases';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import {
  cleanAgents,
  seedAgent,
  GHOST_ID,
  INVALID_ID
} from '../../helpers/db';
import { makeAdapters } from './shared';

describe('GetAgentUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: GetAgentUseCase;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();
    const { repo, logger } = makeAdapters(prisma);
    useCase = new GetAgentUseCase(repo, logger);
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanAgents(prisma);
  });

  it('returns the stored agent', async () => {
    const { id } = await seedAgent(prisma, {
      name: 'Torre Norte',
      status: 'ACTIVE'
    });

    const result = await useCase.execute({ id });

    expect(result.value).toMatchObject({
      id,
      name: 'Torre Norte',
      status: 'ACTIVE'
    });
  });

  it('fails for an unknown agent', async () => {
    expect((await useCase.execute({ id: GHOST_ID })).error).toContain(
      'not found'
    );
  });

  it('fails on a malformed id', async () => {
    expect(
      (await useCase.execute({ id: INVALID_ID })).error
    ).toContain('Invalid agent ID');
  });
});
