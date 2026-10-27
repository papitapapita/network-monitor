// Source: src/application/device-inventory/use-cases/GetTopologyUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import { GetTopologyUseCase } from 'application/device-inventory/use-cases/GetTopologyUseCase';
import { TopologyNodeDTO } from 'application/device-inventory/dtos';
import { PrismaTopologyQuery } from 'infrastructure/persistence/PrismaTopologyQuery';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import {
  cleanAgents,
  cleanDatabase,
  seedAgent,
  seedDeviceModel,
  seedLocation,
  seedNetworkDevice
} from '../../helpers/db';

describe('GetTopologyUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: GetTopologyUseCase;
  let deviceModelId: string;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();
    deviceModelId = await seedDeviceModel(prisma);
    useCase = new GetTopologyUseCase(
      new PrismaTopologyQuery(prisma, true),
      new WinstonLogger()
    );
  });

  afterAll(async () => {
    await cleanAgents(prisma);
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
  });

  const seed = (
    name: string,
    ipAddress: string,
    opts: Partial<Parameters<typeof seedNetworkDevice>[2]> = {}
  ) =>
    seedNetworkDevice(prisma, deviceModelId, {
      name,
      ipAddress,
      monitoringEnabled: true,
      ...opts
    });

  const setState = (
    deviceId: string,
    status: 'UP' | 'DOWN' | 'UNKNOWN',
    downSince: Date | null = null
  ) =>
    prisma.deviceState.create({
      data: { deviceId, status, downSince }
    });

  async function nodes(): Promise<Map<string, TopologyNodeDTO>> {
    const result = await useCase.execute({});
    expect(result.isSuccess).toBe(true);
    return new Map(result.value.nodes.map((n) => [n.id, n]));
  }

  it('returns an empty map with no devices', async () => {
    const result = await useCase.execute({});

    expect(result.value).toEqual({ nodes: [], total: 0 });
  });

  it('lists each device on the network with its link and child count', async () => {
    const locationId = await seedLocation(prisma);
    const router = await seed('Router', '10.0.0.1');
    await prisma.device.update({
      where: { id: router },
      data: { status: 'ACTIVE', locationId }
    });
    const ap = await seed('AP Torre Norte', '10.0.3.2', {
      upstreamDeviceId: router
    });
    await seed('CPE Juan', '10.0.3.21', { upstreamDeviceId: ap });

    const map = await nodes();

    expect(map.size).toBe(3);
    expect(map.get(router)).toMatchObject({
      name: 'Router',
      status: 'ACTIVE',
      ipAddress: '10.0.0.1',
      upstreamDeviceId: null,
      childCount: 1,
      locationId
    });
    expect(map.get(router)!.locationName).not.toBeNull();
    expect(map.get(ap)!.upstreamDeviceId).toBe(router);
    expect(map.get(ap)!.childCount).toBe(1);
  });

  it('leaves out devices that are not on the network, and deleted ones', async () => {
    const ap = await seed('AP', '10.0.3.2');
    await seed('En bodega', '10.0.9.1', { status: 'INVENTORY' });
    const gone = await seed('Borrado', '10.0.9.2', {
      upstreamDeviceId: ap
    });
    await prisma.device.update({
      where: { id: gone },
      data: { deletedAt: new Date() }
    });

    const map = await nodes();

    expect([...map.keys()]).toEqual([ap]);
    expect(map.get(ap)!.childCount).toBe(0);
  });

  it('keeps a device off the network when something on it still hangs off it', async () => {
    const damagedAp = await seed('AP dañado', '10.0.3.2', {
      status: 'DAMAGED'
    });
    const cpe = await seed('CPE', '10.0.3.21', {
      upstreamDeviceId: damagedAp
    });

    const map = await nodes();

    expect(map.get(damagedAp)!.status).toBe('DAMAGED');
    expect(map.get(cpe)!.upstreamDeviceId).toBe(damagedAp);
  });

  describe('[DEV-186] reachability', () => {
    it('reads UP and DOWN from the monitoring state, with when it went down', async () => {
      const ap = await seed('AP', '10.0.3.2');
      const cpe = await seed('CPE', '10.0.3.21');
      const since = new Date('2026-10-26T14:05:00Z');
      await setState(ap, 'UP');
      await setState(cpe, 'DOWN', since);

      const map = await nodes();

      expect(map.get(ap)!.reachability).toBe('UP');
      expect(map.get(ap)!.downSince).toBeNull();
      expect(map.get(cpe)!.reachability).toBe('DOWN');
      expect(map.get(cpe)!.downSince).toBe(since.toISOString());
    });

    it('marks a down device below a down device UNREACHABLE', async () => {
      const sw = await seed('Switch', '10.0.1.1');
      const ap = await seed('AP', '10.0.3.2', {
        upstreamDeviceId: sw
      });
      const cpe = await seed('CPE', '10.0.3.21', {
        upstreamDeviceId: ap
      });
      await setState(sw, 'DOWN', new Date());
      await setState(ap, 'DOWN', new Date());
      await setState(cpe, 'DOWN', new Date());

      const map = await nodes();

      expect(map.get(sw)!.reachability).toBe('DOWN');
      expect(map.get(ap)!.reachability).toBe('UNREACHABLE');
      expect(map.get(cpe)!.reachability).toBe('UNREACHABLE');
    });

    it('is UNKNOWN for an unmonitored device and one never polled', async () => {
      const off = await seed('Sin monitoreo', '10.0.3.2', {
        monitoringEnabled: false
      });
      await setState(off, 'DOWN', new Date());
      const fresh = await seed('Nuevo', '10.0.3.3');

      const map = await nodes();

      expect(map.get(off)!.reachability).toBe('UNKNOWN');
      expect(map.get(fresh)!.reachability).toBe('UNKNOWN');
    });

    it('is UNKNOWN behind an agent that is not reporting (MON-006)', async () => {
      const { id: agentId } = await seedAgent(prisma, {
        status: 'PENDING'
      });
      const cpe = await seed('CPE', '10.0.3.21');
      await prisma.device.update({
        where: { id: cpe },
        data: { agentId }
      });
      await setState(cpe, 'DOWN', new Date());

      const map = await nodes();

      expect(map.get(cpe)!.reachability).toBe('UNKNOWN');
    });
  });
});
