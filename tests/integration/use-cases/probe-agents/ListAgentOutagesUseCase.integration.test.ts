import { PrismaClient } from '../../../../src/generated/prisma/client';
import { ListAgentOutagesUseCase } from 'application/probe-agents/use-cases';
import { PrismaAgentOutageQuery } from 'infrastructure/probe-agents/queries';
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

describe('ListAgentOutagesUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: ListAgentOutagesUseCase;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();
    const { repo, logger } = makeAdapters(prisma);
    useCase = new ListAgentOutagesUseCase(
      repo,
      new PrismaAgentOutageQuery(prisma),
      logger
    );
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanAgents(prisma);
  });

  const at = (hour: number) =>
    new Date(
      `2026-09-28T${String(hour).padStart(2, '0')}:00:00.000Z`
    );

  async function seedOutage(
    agentId: string,
    hour: number,
    ended: boolean
  ): Promise<void> {
    await prisma.probeAgentOutage.create({
      data: {
        agentId,
        silentSince: at(hour),
        offlineSince: new Date(at(hour).getTime() + 5 * 60_000),
        endedAt: ended ? at(hour + 1) : null,
        endReason: ended ? 'RECONNECTED' : null
      }
    });
  }

  it("[AGT-026] lists one agent's outages newest first, with the total", async () => {
    const { id } = await seedAgent(prisma, { status: 'ACTIVE' });
    const other = await seedAgent(prisma, { status: 'ACTIVE' });
    await seedOutage(id, 1, true);
    await seedOutage(id, 5, true);
    await seedOutage(id, 9, false);
    await seedOutage(other.id, 3, true);

    const result = await useCase.execute({ id, limit: 2 });

    expect(result.value.total).toBe(3);
    expect(result.value.hasMore).toBe(true);
    expect(result.value.outages).toEqual([
      {
        id: expect.any(String),
        silentSince: at(9).toISOString(),
        offlineSince: '2026-09-28T09:05:00.000Z',
        endedAt: null,
        endReason: null
      },
      expect.objectContaining({
        silentSince: at(5).toISOString(),
        endedAt: at(6).toISOString(),
        endReason: 'RECONNECTED'
      })
    ]);

    const next = await useCase.execute({ id, limit: 2, offset: 2 });
    expect(next.value.outages.map((o) => o.silentSince)).toEqual([
      at(1).toISOString()
    ]);
    expect(next.value.hasMore).toBe(false);
  });

  it('answers an empty page for an agent that was never offline', async () => {
    const { id } = await seedAgent(prisma, { status: 'ACTIVE' });

    const result = await useCase.execute({ id });

    expect(result.value).toEqual({
      outages: [],
      total: 0,
      limit: 20,
      offset: 0,
      hasMore: false
    });
  });

  it('fails for an unknown agent', async () => {
    const result = await useCase.execute({ id: GHOST_ID });

    expect(result.error).toBe(`Agent not found: ${GHOST_ID}`);
  });

  it('fails on a malformed id', async () => {
    const result = await useCase.execute({ id: INVALID_ID });

    expect(result.error).toMatch(/^Invalid agent ID/);
  });
});
