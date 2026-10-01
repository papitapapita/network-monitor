import { PrismaClient } from '../../../../src/generated/prisma/client';
import { RecordAgentUpdateOutcomeUseCase } from 'application/probe-agents/use-cases';
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
import { AgentUpdateFailedEvent } from 'domain/probe-agents/events';
import { IDomainEvent } from 'domain/shared/interfaces';
import { captureAgentHealthEvents, makeAdapters } from './shared';

describe('RecordAgentUpdateOutcomeUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: RecordAgentUpdateOutcomeUseCase;
  let events: IDomainEvent[];

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();
    const { repo, logger } = makeAdapters(prisma);
    useCase = new RecordAgentUpdateOutcomeUseCase(repo, logger);
    events = captureAgentHealthEvents();
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanAgents(prisma);
    events.length = 0;
  });

  const flush = () => new Promise((resolve) => setImmediate(resolve));

  it('[AGT-084] persists an installed update and alerts no one', async () => {
    const { id } = await seedAgent(prisma, { status: 'ACTIVE' });

    const result = await useCase.execute({
      agentId: id,
      version: '0.2.1',
      outcome: 'INSTALLED',
      reason: 'ignored'
    });
    await flush();

    expect(result.isSuccess).toBe(true);
    const row = await prisma.probeAgent.findUnique({ where: { id } });
    expect(row).toMatchObject({
      lastUpdateVersion: '0.2.1',
      lastUpdateOutcome: 'INSTALLED',
      lastUpdateReason: null
    });
    expect(events).toHaveLength(0);
  });

  it('[AGT-084] persists a failure with its reason and raises one event, even when reported twice', async () => {
    const { id } = await seedAgent(prisma, { status: 'ACTIVE' });
    const report = {
      agentId: id,
      version: '0.2.1',
      outcome: 'ROLLED_BACK' as const,
      reason: 'No connection within 2 minutes'
    };

    await useCase.execute(report);
    await useCase.execute(report);
    await flush();

    const row = await prisma.probeAgent.findUnique({ where: { id } });
    expect(row).toMatchObject({
      lastUpdateOutcome: 'ROLLED_BACK',
      lastUpdateReason: 'No connection within 2 minutes'
    });
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(AgentUpdateFailedEvent);
  });

  it('refuses a revoked agent', async () => {
    const { id } = await seedAgent(prisma, { status: 'REVOKED' });

    const result = await useCase.execute({
      agentId: id,
      version: '0.2.1',
      outcome: 'INSTALLED',
      reason: null
    });

    expect(result.isFailure).toBe(true);
  });

  it.each([
    ['a missing agent', GHOST_ID],
    ['a malformed id', INVALID_ID]
  ])('fails for %s', async (_label, agentId) => {
    const result = await useCase.execute({
      agentId,
      version: '0.2.1',
      outcome: 'INSTALLED',
      reason: null
    });

    expect(result.isFailure).toBe(true);
  });
});
