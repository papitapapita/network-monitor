import { PrismaClient } from '../../../../src/generated/prisma/client';
import { Result } from 'domain/shared/core';
import { WatchRouterTrafficUseCase } from 'application/device-monitoring/use-cases/WatchRouterTrafficUseCase';
import { RouterTrafficDTO } from 'application/device-monitoring/dtos';
import {
  PrismaRouterTrafficTargetsQuery,
  RouterTrafficMonitor
} from 'infrastructure/monitoring/router-traffic';
import { SseBroadcaster } from 'infrastructure/realtime/SseBroadcaster';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import { cleanDatabase, seedVendor } from '../../helpers/db';
import { FakeRouterTrafficReader } from '../../helpers/FakeRouterTrafficReader';
import { seedMainRouter } from '../../helpers/routerTraffic';

const ETHER1 = {
  name: 'ether1-wan',
  type: 'ether',
  running: true,
  rxBps: 120_000_000,
  txBps: 15_000_000
};

const LOGIN = { username: 'api', password: 'secreto', apiPort: 8728 };

async function until(
  condition: () => boolean,
  timeoutMs = 2_000
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error('condition never met');
    await new Promise((r) => setTimeout(r, 10));
  }
}

// A viewer on the router-traffic channel, collecting the frames it gets.
function viewer(hub: SseBroadcaster): {
  frames: RouterTrafficDTO[];
  leave: () => void;
} {
  const frames: RouterTrafficDTO[] = [];
  const leave = hub.subscribe('router-traffic', {
    write: (chunk: string) => {
      const data = /data: (.*)\n/.exec(chunk);
      if (chunk.startsWith('event: router-traffic\n') && data) {
        frames.push(JSON.parse(data[1]) as RouterTrafficDTO);
      }
    },
    end: () => undefined
  });
  return { frames, leave };
}

describe('WatchRouterTrafficUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let hub: SseBroadcaster;
  let reader: FakeRouterTrafficReader;
  let monitor: RouterTrafficMonitor;
  let useCase: WatchRouterTrafficUseCase;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    const logger = new WinstonLogger();
    hub = new SseBroadcaster(logger);
    reader = new FakeRouterTrafficReader();
    monitor = new RouterTrafficMonitor(
      new PrismaRouterTrafficTargetsQuery(prisma),
      reader,
      hub,
      logger,
      { intervalMs: 50 }
    );
    useCase = new WatchRouterTrafficUseCase(monitor, logger);
  });

  afterEach(async () => {
    await monitor.stop();
    hub.closeAll();
  });

  afterAll(async () => {
    await container.disconnect();
  });

  describe('[MON-060] which routers are shown', () => {
    it('lists the in-service GATEWAY devices by name', async () => {
      await seedMainRouter(prisma, {
        name: 'Core B',
        ip: '10.0.0.2',
        login: LOGIN
      });
      await seedMainRouter(prisma, {
        name: 'Core A',
        ip: '10.0.0.1',
        login: LOGIN,
        status: 'COMMISSIONING'
      });

      const result = await useCase.execute();

      expect(result.isSuccess).toBe(true);
      expect(result.value.routers.map((r) => r.deviceName)).toEqual([
        'Core A',
        'Core B'
      ]);
    });

    it('leaves out other categories, stock and deleted devices', async () => {
      await seedMainRouter(prisma, {
        name: 'AP',
        ip: '10.0.0.3',
        login: LOGIN,
        category: 'ACCESS_POINT'
      });
      await seedMainRouter(prisma, {
        name: 'In stock',
        ip: null,
        login: LOGIN,
        status: 'INVENTORY'
      });
      const deleted = await seedMainRouter(prisma, {
        name: 'Deleted',
        ip: '10.0.0.4',
        login: LOGIN
      });
      await prisma.device.update({
        where: { id: deleted },
        data: { deletedAt: new Date() }
      });

      const result = await useCase.execute();

      expect(result.value.routers).toEqual([]);
    });
  });

  describe('[MON-061] routers that cannot be read', () => {
    it('lists a router from another vendor with the reason', async () => {
      const vendorId = await seedVendor(prisma, {
        name: 'Ubiquiti',
        slug: 'ubiquiti'
      });
      const model = await prisma.deviceModel.upsert({
        where: {
          vendorId_model: { vendorId, model: 'EdgeRouter X' }
        },
        update: {},
        create: {
          vendorId,
          model: 'EdgeRouter X',
          deviceType: 'ROUTER'
        }
      });
      await seedMainRouter(prisma, {
        name: 'Edge',
        ip: '10.0.0.5',
        login: LOGIN,
        deviceModelId: model.id
      });

      const result = await useCase.execute();

      expect(result.value.routers).toEqual([
        expect.objectContaining({
          deviceName: 'Edge',
          at: null,
          error: 'Live traffic is read from MikroTik routers only',
          interfaces: []
        })
      ]);
      expect(reader.reads).toHaveLength(0);
    });

    it('lists a router with no IP address with the reason', async () => {
      await seedMainRouter(prisma, {
        name: 'No IP',
        ip: null,
        login: LOGIN
      });

      const result = await useCase.execute();

      expect(result.value.routers[0].error).toBe(
        'The router has no IP address'
      );
    });

    it('lists a router with no saved login with the reason', async () => {
      await seedMainRouter(prisma, {
        name: 'No login',
        ip: '10.0.0.6',
        login: null
      });

      const result = await useCase.execute();

      expect(result.value.routers[0].error).toBe(
        'The router has no username and password saved'
      );
    });
  });

  describe('[MON-062] reading while watched', () => {
    it('reads each router with its API login and streams the rates', async () => {
      await seedMainRouter(prisma, {
        name: 'Core',
        ip: '10.0.0.1',
        login: { username: 'api', password: 'secreto', apiPort: 8729 }
      });
      reader.answer('10.0.0.1', Result.ok([ETHER1]));
      const watching = viewer(hub);

      await useCase.execute();
      await until(() => watching.frames.length >= 1);

      expect(reader.reads[0]).toEqual({
        host: '10.0.0.1',
        port: 8729,
        username: 'api',
        password: 'secreto',
        agentId: null
      });
      expect(watching.frames[0]).toEqual(
        expect.objectContaining({
          deviceName: 'Core',
          error: null,
          interfaces: [ETHER1]
        })
      );
      watching.leave();
    });

    it('streams the error when a read fails', async () => {
      await seedMainRouter(prisma, {
        name: 'Core',
        ip: '10.0.0.1',
        login: LOGIN
      });
      reader.answer(
        '10.0.0.1',
        Result.fail('RouterOS API error: connect ECONNREFUSED')
      );
      const watching = viewer(hub);

      await useCase.execute();
      await until(() => watching.frames.length >= 1);

      expect(watching.frames[0]).toEqual(
        expect.objectContaining({
          error: 'RouterOS API error: connect ECONNREFUSED',
          interfaces: []
        })
      );
      watching.leave();
    });

    it('opens a later viewer with the newest reading', async () => {
      await seedMainRouter(prisma, {
        name: 'Core',
        ip: '10.0.0.1',
        login: LOGIN
      });
      reader.answer('10.0.0.1', Result.ok([ETHER1]));
      const first = viewer(hub);
      await useCase.execute();
      await until(() => first.frames.length >= 1);

      const second = await useCase.execute();

      expect(second.value.routers[0].interfaces).toEqual([ETHER1]);
      first.leave();
    });

    it('stops reading and closes the logins once nobody watches', async () => {
      await seedMainRouter(prisma, {
        name: 'Core',
        ip: '10.0.0.1',
        login: LOGIN
      });
      reader.answer('10.0.0.1', Result.ok([ETHER1]));
      const watching = viewer(hub);
      await useCase.execute();
      await until(() => watching.frames.length >= 2);

      watching.leave();
      await until(() => reader.released >= 1);
      const readsWhenStopped = reader.reads.length;
      await new Promise((r) => setTimeout(r, 200));

      expect(reader.reads.length).toBe(readsWhenStopped);
    });
  });
});
