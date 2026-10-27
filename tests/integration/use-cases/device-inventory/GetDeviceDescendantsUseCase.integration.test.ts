// Source: src/application/device-inventory/use-cases/GetDeviceDescendantsUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import { GetDeviceDescendantsUseCase } from 'application/device-inventory/use-cases/GetDeviceDescendantsUseCase';
import { PrismaTopologyQuery } from 'infrastructure/persistence/PrismaTopologyQuery';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import {
  cleanDatabase,
  seedDeviceModel,
  seedNetworkDevice,
  GHOST_ID,
  INVALID_ID
} from '../../helpers/db';

describe('GetDeviceDescendantsUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: GetDeviceDescendantsUseCase;
  let deviceModelId: string;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();
    deviceModelId = await seedDeviceModel(prisma);
    useCase = new GetDeviceDescendantsUseCase(
      new PrismaTopologyQuery(prisma, true),
      new WinstonLogger()
    );
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
  });

  const seed = (
    name: string,
    ipAddress: string,
    upstreamDeviceId: string | null = null
  ) =>
    seedNetworkDevice(prisma, deviceModelId, {
      name,
      ipAddress,
      upstreamDeviceId,
      monitoringEnabled: true
    });

  it('returns the device and everything below it, and nothing beside it', async () => {
    const router = await seed('Router', '10.0.0.1');
    const ap = await seed('AP Norte', '10.0.3.2', router);
    const cpe = await seed('CPE Juan', '10.0.3.21', ap);
    const behindCpe = await seed('Router Juan', '10.0.3.22', cpe);
    await seed('AP Sur', '10.0.4.2', router);

    const result = await useCase.execute({ deviceId: ap });

    expect(result.value.nodes.map((n) => n.id)).toEqual([
      ap,
      cpe,
      behindCpe
    ]);
  });

  it('[DEV-186] judges the subtree against the devices above it', async () => {
    const router = await seed('Router', '10.0.0.1');
    const ap = await seed('AP Norte', '10.0.3.2', router);
    await prisma.deviceState.createMany({
      data: [
        { deviceId: router, status: 'DOWN', downSince: new Date() },
        { deviceId: ap, status: 'DOWN', downSince: new Date() }
      ]
    });

    const result = await useCase.execute({ deviceId: ap });

    expect(result.value.nodes[0].reachability).toBe('UNREACHABLE');
  });

  it('fails with not found for an unknown device', async () => {
    const result = await useCase.execute({ deviceId: GHOST_ID });

    expect(result.error).toMatch(/not found/i);
  });

  it('fails with a malformed id', async () => {
    const result = await useCase.execute({ deviceId: INVALID_ID });

    expect(result.error).toMatch(/invalid device id/i);
  });
});
