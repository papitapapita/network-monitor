import { PrismaClient } from '../../../../src/generated/prisma/client';
import { MarkSilentAgentsOfflineUseCase } from 'application/probe-agents/use-cases';
import { PrismaAgentRepository } from 'infrastructure/probe-agents/repositories';
import { Agent } from 'domain/probe-agents';
import { AgentWentOfflineEvent } from 'domain/probe-agents/events';
import { AgentId } from 'domain/shared/ids';
import { IDomainEvent } from 'domain/shared/interfaces';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import { cleanAgents, seedAgent } from '../../helpers/db';
import { captureAgentHealthEvents, makeAdapters } from './shared';

const minutesAgo = (minutes: number) =>
  new Date(Date.now() - minutes * 60_000);

describe('MarkSilentAgentsOfflineUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let repo: PrismaAgentRepository;
  let useCase: MarkSilentAgentsOfflineUseCase;
  let events: IDomainEvent[];

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();
    const adapters = makeAdapters(prisma);
    repo = adapters.repo;
    useCase = new MarkSilentAgentsOfflineUseCase(
      repo,
      adapters.logger
    );
    events = captureAgentHealthEvents();
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanAgents(prisma);
    events.length = 0;
  });

  async function seedActive(data: {
    lastSeenAt?: Date | null;
    enrolledAt?: Date;
    offlineSince?: Date | null;
    name?: string;
  }): Promise<string> {
    const { id } = await seedAgent(prisma, {
      status: 'ACTIVE',
      name: data.name
    });
    await prisma.probeAgent.update({ where: { id }, data });
    return id;
  }

  it('[AGT-021] marks an agent silent for 5 minutes offline and dispatches one event', async () => {
    const id = await seedActive({
      name: 'Torre Norte',
      lastSeenAt: minutesAgo(6)
    });

    const result = await useCase.execute();

    expect(result.value.markedOffline).toEqual([id]);
    const row = await prisma.probeAgent.findUnique({ where: { id } });
    expect(row!.offlineSince).not.toBeNull();
    expect(row!.lastSeenAt).toEqual(expect.any(Date));
    expect(events).toHaveLength(1);
    const event = events[0] as AgentWentOfflineEvent;
    expect(event).toBeInstanceOf(AgentWentOfflineEvent);
    expect(event.agentName).toBe('Torre Norte');
    expect(event.silentSince).toEqual(row!.lastSeenAt);
  });

  it('[AGT-021] counts from enrollment for an agent that never connected', async () => {
    const id = await seedActive({
      lastSeenAt: null,
      enrolledAt: minutesAgo(10)
    });

    const result = await useCase.execute();

    expect(result.value.markedOffline).toEqual([id]);
  });

  it('[AGT-021] leaves recent, pending, revoked and already-offline agents alone', async () => {
    await seedActive({ lastSeenAt: minutesAgo(4) });
    await seedActive({
      lastSeenAt: minutesAgo(30),
      offlineSince: minutesAgo(25)
    });
    const pending = await seedAgent(prisma, { status: 'PENDING' });
    const revoked = await seedAgent(prisma, { status: 'REVOKED' });
    await prisma.probeAgent.updateMany({
      where: { id: { in: [pending.id, revoked.id] } },
      data: { createdAt: minutesAgo(60) }
    });

    const result = await useCase.execute();

    expect(result.value.markedOffline).toEqual([]);
    expect(events).toHaveLength(0);
  });

  it('[AGT-021] a second scan does not alert again', async () => {
    await seedActive({ lastSeenAt: minutesAgo(6) });
    await useCase.execute();
    events.length = 0;

    const second = await useCase.execute();

    expect(second.value.markedOffline).toEqual([]);
    expect(events).toHaveLength(0);
  });

  it('[AGT-024] does not overwrite a contact that landed after the agent was read', async () => {
    const id = await seedActive({ lastSeenAt: minutesAgo(6) });
    const agent = (await repo.findById(AgentId.parse(id).value))
      .value as Agent;
    const loadedUpdatedAt = agent.updatedAt;
    const heartbeat = new Date();
    await prisma.probeAgent.update({
      where: { id },
      data: { lastSeenAt: heartbeat }
    });

    agent.markOffline();
    const saved = await repo.saveIfUnchanged(agent, loadedUpdatedAt);

    expect(saved.value).toBe(false);
    const row = await prisma.probeAgent.findUnique({ where: { id } });
    expect(row!.offlineSince).toBeNull();
    expect(row!.lastSeenAt).toEqual(heartbeat);
    expect(events).toHaveLength(0);
  });
});
