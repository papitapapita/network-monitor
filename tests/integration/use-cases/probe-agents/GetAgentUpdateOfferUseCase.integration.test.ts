import { PrismaClient } from '../../../../src/generated/prisma/client';
import { GetAgentUpdateOfferUseCase } from 'application/probe-agents/use-cases';
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
import { FakeAgentReleaseCatalog } from '../../helpers/FakeAgentReleaseCatalog';
import { makeAdapters } from './shared';

describe('GetAgentUpdateOfferUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let releases: FakeAgentReleaseCatalog;
  let useCase: GetAgentUpdateOfferUseCase;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();
    const { repo, logger } = makeAdapters(prisma);
    releases = new FakeAgentReleaseCatalog();
    useCase = new GetAgentUpdateOfferUseCase(repo, releases, logger);
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanAgents(prisma);
    releases.release = null;
  });

  it('[AGT-082] offers a newer release to an agent running an older one', async () => {
    const { id } = await seedAgent(prisma, { status: 'ACTIVE' });
    releases.publish('0.2.1', 'win-x64');

    const result = await useCase.execute({
      agentId: id,
      platform: 'win-x64',
      runningVersion: '0.2.0'
    });

    expect(result.value).toMatchObject({
      version: '0.2.1',
      file: 'nms-agent-0.2.1-win-x64.gz'
    });
  });

  it('[AGT-082] offers nothing for a release that already failed on the stored agent', async () => {
    const { id } = await seedAgent(prisma, { status: 'ACTIVE' });
    await prisma.probeAgent.update({
      where: { id },
      data: {
        lastUpdateVersion: '0.2.1',
        lastUpdateOutcome: 'REJECTED',
        lastUpdateReason: 'Signature does not verify',
        lastUpdateAt: new Date()
      }
    });
    releases.publish('0.2.1', 'win-x64');

    const result = await useCase.execute({
      agentId: id,
      platform: 'win-x64',
      runningVersion: '0.2.0'
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value).toBeNull();
  });

  it.each([
    ['a missing agent', GHOST_ID],
    ['a malformed id', INVALID_ID]
  ])('fails for %s', async (_label, agentId) => {
    releases.publish('0.2.1', 'win-x64');

    const result = await useCase.execute({
      agentId,
      platform: 'win-x64',
      runningVersion: '0.2.0'
    });

    expect(result.isFailure).toBe(true);
  });
});
