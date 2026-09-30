import { PrismaClient } from '../../../../src/generated/prisma/client';
import { ListAgentsUseCase } from 'application/probe-agents/use-cases';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import {
  cleanDatabase,
  seedAgent,
  seedDevice,
  seedDeviceModel
} from '../../helpers/db';
import { makeAdapters } from './shared';

describe('ListAgentsUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: ListAgentsUseCase;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();
    const { repo, deviceCounts, logger } = makeAdapters(prisma);
    useCase = new ListAgentsUseCase(repo, deviceCounts, logger);
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
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

  it('[AGT-010] counts the live devices behind each agent, not the recycle bin', async () => {
    const busy = await seedAgent(prisma, {
      name: 'A',
      status: 'ACTIVE'
    });
    await seedAgent(prisma, { name: 'B', status: 'ACTIVE' });
    const modelId = await seedDeviceModel(prisma);
    const place = async (serialNumber: string, deleted = false) => {
      const id = await seedDevice(prisma, modelId, { serialNumber });
      await prisma.device.update({
        where: { id },
        data: {
          agentId: busy.id,
          deletedAt: deleted ? new Date() : null
        }
      });
    };
    await place('SN-AGT-010-1');
    await place('SN-AGT-010-2');
    await place('SN-AGT-010-3', true);
    await seedDevice(prisma, modelId, {
      serialNumber: 'SN-AGT-010-4'
    });

    const result = await useCase.execute();

    expect(
      result.value.agents.map((a) => [a.name, a.deviceCount])
    ).toEqual([
      ['A', 2],
      ['B', 0]
    ]);
  });

  it('returns an empty list when there are none', async () => {
    expect((await useCase.execute()).value.agents).toEqual([]);
  });
});
