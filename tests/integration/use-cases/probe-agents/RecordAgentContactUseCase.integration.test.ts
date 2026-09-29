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
import { makeAdapters } from './shared';

describe('RecordAgentContactUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: RecordAgentContactUseCase;
  const receivedAt = new Date('2026-09-28T12:00:00.000Z');

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();
    const { repo, logger } = makeAdapters(prisma);
    useCase = new RecordAgentContactUseCase(repo, logger);
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanAgents(prisma);
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
