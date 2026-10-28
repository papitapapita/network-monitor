// Source: src/application/device-inventory/use-cases/UpdateDiscoverySettingsUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import {
  createTestPrisma,
  cleanDatabase,
  GHOST_ID,
  seedAgent
} from '../../helpers/db';
import { UpdateDiscoverySettingsUseCase } from 'application/device-inventory/use-cases';
import { PrismaDiscoverySettingsRepository } from 'infrastructure/persistence';
import { PrismaAgentAssignmentQuery } from 'infrastructure/probe-agents/queries';

describe('UpdateDiscoverySettingsUseCase — integration', () => {
  let prisma: PrismaClient;

  function makeUseCase(
    serverOnSite = true
  ): UpdateDiscoverySettingsUseCase {
    return new UpdateDiscoverySettingsUseCase(
      new PrismaDiscoverySettingsRepository(prisma),
      new PrismaAgentAssignmentQuery(prisma),
      new WinstonLogger(),
      serverOnSite
    );
  }

  beforeAll(() => {
    prisma = createTestPrisma();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
  });

  it('[DEV-210] saves the settings, replacing the earlier ones', async () => {
    const agent = await seedAgent(prisma, { status: 'ACTIVE' });
    await makeUseCase().execute({
      enabled: false,
      intervalHours: 1,
      segments: [{ cidr: '10.9.9.0/24', agentId: null }]
    });

    const result = await makeUseCase().execute({
      enabled: true,
      intervalHours: 12,
      segments: [
        { cidr: '192.168.1.40/24', agentId: null },
        { cidr: '10.0.0.0/22', agentId: agent.id }
      ]
    });

    const row = await prisma.discoverySettings.findUniqueOrThrow({
      where: { id: 1 }
    });
    expect(result.isSuccess).toBe(true);
    expect(row).toMatchObject({
      enabled: true,
      intervalHours: 12,
      segments: [
        { cidr: '192.168.1.0/24', agentId: null },
        { cidr: '10.0.0.0/22', agentId: agent.id }
      ]
    });
  });

  it('[DEV-211] keeps the last run when the settings change', async () => {
    const lastRunAt = new Date('2026-11-03T12:00:00Z');
    await prisma.discoverySettings.create({
      data: {
        enabled: true,
        intervalHours: 24,
        segments: [],
        lastRunAt
      }
    });

    const result = await makeUseCase().execute({
      enabled: true,
      intervalHours: 6,
      segments: []
    });

    expect(result.value.lastRunAt).toBe(lastRunAt.toISOString());
  });

  it('[DEV-212] a pending agent can take a segment', async () => {
    const agent = await seedAgent(prisma, { status: 'PENDING' });

    const result = await makeUseCase().execute({
      enabled: true,
      intervalHours: 24,
      segments: [{ cidr: '10.0.0.0/24', agentId: agent.id }]
    });

    expect(result.isSuccess).toBe(true);
  });

  it('[DEV-212] refuses a revoked agent, saving nothing', async () => {
    const agent = await seedAgent(prisma, { status: 'REVOKED' });

    const result = await makeUseCase().execute({
      enabled: true,
      intervalHours: 24,
      segments: [{ cidr: '10.0.0.0/24', agentId: agent.id }]
    });

    expect(result.error).toBe(
      'segment 10.0.0.0/24: agentId must be an agent that is not revoked'
    );
    expect(await prisma.discoverySettings.count()).toBe(0);
  });

  it('[DEV-212] refuses an agent that does not exist', async () => {
    const result = await makeUseCase().execute({
      enabled: true,
      intervalHours: 24,
      segments: [{ cidr: '10.0.0.0/24', agentId: GHOST_ID }]
    });

    expect(result.isFailure).toBe(true);
  });

  it('[DEV-212] off site, refuses a server segment', async () => {
    const result = await makeUseCase(false).execute({
      enabled: true,
      intervalHours: 24,
      segments: [{ cidr: '10.0.0.0/24', agentId: null }]
    });

    expect(result.error).toBe(
      'segment 10.0.0.0/24 needs an agent — this server is not on the monitored network'
    );
  });
});
