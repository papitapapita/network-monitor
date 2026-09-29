import { PrismaClient } from '../../../../src/generated/prisma/client';
import { ListAgentsUseCase } from 'application/probe-agents/use-cases';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import { cleanAgents, seedAgent } from '../../helpers/db';
import { makeAdapters } from './shared';

describe('ListAgentsUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: ListAgentsUseCase;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();
    const { repo, logger } = makeAdapters(prisma);
    useCase = new ListAgentsUseCase(repo, logger);
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanAgents(prisma);
  });

  it('lists agents of every status, oldest first', async () => {
    await seedAgent(prisma, { name: 'A', status: 'PENDING' });
    await seedAgent(prisma, { name: 'B', status: 'ACTIVE' });
    await seedAgent(prisma, { name: 'C', status: 'REVOKED' });

    const result = await useCase.execute();

    expect(
      result.value.agents.map((a) => [a.name, a.status])
    ).toEqual([
      ['A', 'PENDING'],
      ['B', 'ACTIVE'],
      ['C', 'REVOKED']
    ]);
  });

  it('returns an empty list when there are none', async () => {
    expect((await useCase.execute()).value.agents).toEqual([]);
  });
});
