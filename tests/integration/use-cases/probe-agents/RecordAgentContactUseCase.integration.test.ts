import { PrismaClient } from '../../../../src/generated/prisma/client';
import { RecordAgentContactUseCase } from 'application/probe-agents/use-cases';
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
import {
  AgentCameBackEvent,
  AgentClockCorrectedEvent,
  AgentClockDriftedEvent
} from 'domain/probe-agents/events';
import { IDomainEvent } from 'domain/shared/interfaces';
import { captureAgentHealthEvents, makeAdapters } from './shared';

describe('RecordAgentContactUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: RecordAgentContactUseCase;
  let events: IDomainEvent[];
  const receivedAt = new Date('2026-09-28T12:00:00.000Z');

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();
    const { repo, logger } = makeAdapters(prisma);
    useCase = new RecordAgentContactUseCase(repo, logger);
    events = captureAgentHealthEvents();
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanAgents(prisma);
    events.length = 0;
  });

  it('[AGT-020] persists last seen, version and clock offset', async () => {
    const { id } = await seedAgent(prisma, { status: 'ACTIVE' });

    await useCase.execute({
      agentId: id,
      agentVersion: '1.4.2',
      sentAt: receivedAt.getTime() - 2_500,
      receivedAt
    });

    const row = await prisma.probeAgent.findUnique({ where: { id } });
    expect(row!.lastSeenAt).toEqual(receivedAt);
    expect(row!.agentVersion).toBe('1.4.2');
    expect(row!.clockOffsetMs).toBe(-2_500);
    expect(row!.status).toBe('ACTIVE');
  });

  it('[AGT-022] brings an offline agent back and dispatches AgentCameBack', async () => {
    const { id } = await seedAgent(prisma, { status: 'ACTIVE' });
    const offlineSince = new Date('2026-09-28T11:50:00.000Z');
    await prisma.probeAgent.update({
      where: { id },
      data: {
        lastSeenAt: new Date('2026-09-28T11:45:00.000Z'),
        offlineSince
      }
    });

    const result = await useCase.execute({
      agentId: id,
      agentVersion: '1.4.2',
      sentAt: receivedAt.getTime(),
      receivedAt
    });

    expect(result.isSuccess).toBe(true);
    const row = await prisma.probeAgent.findUnique({ where: { id } });
    expect(row!.offlineSince).toBeNull();
    expect(row!.lastSeenAt).toEqual(receivedAt);
    expect(events).toHaveLength(1);
    const event = events[0] as AgentCameBackEvent;
    expect(event).toBeInstanceOf(AgentCameBackEvent);
    expect(event.offlineSince).toEqual(offlineSince);
  });

  it('[AGT-022] dispatches nothing for a contact while online', async () => {
    const { id } = await seedAgent(prisma, { status: 'ACTIVE' });

    await useCase.execute({
      agentId: id,
      agentVersion: '1.0.0',
      sentAt: receivedAt.getTime(),
      receivedAt
    });

    expect(events).toHaveLength(0);
  });

  it('[AGT-025] stores a clock drift past a minute and dispatches one warning', async () => {
    const { id } = await seedAgent(prisma, { status: 'ACTIVE' });
    const contact = (at: Date) =>
      useCase.execute({
        agentId: id,
        agentVersion: '1.0.0',
        sentAt: at.getTime() + 120_000,
        receivedAt: at
      });

    await contact(receivedAt);
    await contact(new Date(receivedAt.getTime() + 30_000));

    const row = await prisma.probeAgent.findUnique({ where: { id } });
    expect(row!.clockDriftSince).toEqual(receivedAt);
    expect(events).toEqual([expect.any(AgentClockDriftedEvent)]);
  });

  it('[AGT-025] clears the warning once the clock is fixed', async () => {
    const { id } = await seedAgent(prisma, { status: 'ACTIVE' });
    await prisma.probeAgent.update({
      where: { id },
      data: { clockOffsetMs: 120_000, clockDriftSince: receivedAt }
    });
    const at = new Date(receivedAt.getTime() + 60_000);

    await useCase.execute({
      agentId: id,
      agentVersion: '1.0.0',
      sentAt: at.getTime() + 1_000,
      receivedAt: at
    });

    const row = await prisma.probeAgent.findUnique({ where: { id } });
    expect(row!.clockDriftSince).toBeNull();
    expect(events).toEqual([expect.any(AgentClockCorrectedEvent)]);
  });

  it('writes nothing for a revoked agent', async () => {
    const { id } = await seedAgent(prisma, { status: 'REVOKED' });

    const result = await useCase.execute({
      agentId: id,
      agentVersion: '1.0.0',
      sentAt: receivedAt.getTime(),
      receivedAt
    });

    expect(result.isFailure).toBe(true);
    const row = await prisma.probeAgent.findUnique({ where: { id } });
    expect(row!.lastSeenAt).toBeNull();
  });

  it('fails for an unknown agent', async () => {
    const result = await useCase.execute({
      agentId: GHOST_ID,
      agentVersion: '1.0.0',
      sentAt: 0,
      receivedAt
    });

    expect(result.error).toContain('not found');
  });

  it('fails on a malformed id', async () => {
    const result = await useCase.execute({
      agentId: INVALID_ID,
      agentVersion: '1.0.0',
      sentAt: 0,
      receivedAt
    });

    expect(result.error).toContain('Invalid agent ID');
  });
});
