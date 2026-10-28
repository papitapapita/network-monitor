// Source: src/application/device-monitoring/use-cases/ListRouterPortSpeedsUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import { Result } from '../../../../src/domain/shared/core';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import { cleanDatabase, seedAgent } from '../../helpers/db';
import {
  FakeRouterPortReader,
  linkedPort,
  unlinkedPort
} from '../../helpers/FakeRouterPortReader';
import {
  buildPortSpeeds,
  seedExpectedSpeed,
  seedMikrotikModel,
  seedRouter
} from '../../helpers/portSpeeds';

describe('ListRouterPortSpeedsUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let routerboardId: string;
  const reader = new FakeRouterPortReader();

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    reader.reset();
    await cleanDatabase(prisma);
    routerboardId = await seedMikrotikModel(prisma, 'ROUTERBOARD');
  });

  const list = (serverOnSite = true) =>
    buildPortSpeeds(prisma, reader, { serverOnSite }).list.execute();
  const names = async (serverOnSite = true) =>
    (await list(serverOnSite)).value.routers.map((r) => r.name);

  describe('which devices', () => {
    it("[MON-140] should list the company's MikroTik routerboards, routers and switches in service, by name", async () => {
      await seedRouter(prisma, {
        name: 'hEX Torre Sur',
        deviceModelId: routerboardId,
        status: 'COMMISSIONING'
      });
      await seedRouter(prisma, {
        name: 'CRS Core',
        deviceModelId: await seedMikrotikModel(prisma, 'SWITCH')
      });
      await seedRouter(prisma, {
        name: 'CCR Border',
        deviceModelId: await seedMikrotikModel(prisma, 'ROUTER')
      });

      expect(await names()).toEqual([
        'CCR Border',
        'CRS Core',
        'hEX Torre Sur'
      ]);
    });

    it('[MON-140] should list a MikroTik of any model type that is the gateway or an aggregation switch', async () => {
      const radioId = await seedMikrotikModel(prisma, 'RADIO');
      await seedRouter(prisma, {
        name: 'Gateway',
        deviceModelId: radioId,
        category: 'GATEWAY'
      });
      await seedRouter(prisma, {
        name: 'Aggregation',
        deviceModelId: radioId,
        category: 'AGGREGATION_SWITCH'
      });
      await seedRouter(prisma, {
        name: 'Just a radio',
        deviceModelId: radioId
      });

      expect(await names()).toEqual(['Aggregation', 'Gateway']);
    });

    it('[MON-140] should leave out customer equipment, stock, deleted devices, SwOS switches and other vendors', async () => {
      await seedRouter(prisma, {
        name: 'Customer hAP',
        deviceModelId: routerboardId,
        owner: 'CLIENT'
      });
      await seedRouter(prisma, {
        name: 'In the box',
        deviceModelId: routerboardId,
        status: 'INVENTORY'
      });
      const deleted = await seedRouter(prisma, {
        name: 'Gone',
        deviceModelId: routerboardId
      });
      await prisma.device.update({
        where: { id: deleted },
        data: { deletedAt: new Date() }
      });
      await seedRouter(prisma, {
        name: 'CSS SwOS',
        deviceModelId: await seedMikrotikModel(prisma, 'SWITCH', {
          swos: true
        })
      });
      await seedRouter(prisma, {
        name: 'Other vendor',
        deviceModelId: await seedMikrotikModel(prisma, 'ROUTER', {
          vendorSlug: 'tplink'
        })
      });

      expect(await names()).toEqual([]);
    });
  });

  it('[MON-141] should read each router with its saved login on its API port', async () => {
    await seedRouter(prisma, {
      name: 'Core',
      deviceModelId: routerboardId,
      ip: '10.0.0.1',
      login: { username: 'monitor', password: 's3cret' }
    });
    reader.serve('10.0.0.1', []);

    await list();

    expect(reader.reads).toEqual([
      {
        host: '10.0.0.1',
        login: {
          username: 'monitor',
          password: 's3cret',
          apiPort: 8729
        }
      }
    ]);
  });

  it('[MON-143] should judge each port against its stored expected speed', async () => {
    const coreId = await seedRouter(prisma, {
      name: 'Core',
      deviceModelId: routerboardId,
      ip: '10.0.0.1'
    });
    await seedExpectedSpeed(prisma, coreId, 'ether1', 1000);
    await seedExpectedSpeed(prisma, coreId, 'ether2', 1000);
    await seedExpectedSpeed(prisma, coreId, 'ether4', 100);
    reader.serve(
      '10.0.0.1',
      [
        linkedPort('ether1', 1000, 'Uplink'),
        linkedPort('ether2', 100, 'Torre Norte'),
        unlinkedPort('ether3')
      ],
      'Core-Insetel'
    );

    const result = await list();

    const [router] = result.value.routers;
    expect(router).toMatchObject({
      deviceId: coreId,
      name: 'Core',
      identity: 'Core-Insetel',
      readable: true,
      error: null
    });
    expect(
      router!.ports.map((p) => [p.name, p.expectedMbps, p.verdict])
    ).toEqual([
      ['ether1', 1000, 'OK'],
      ['ether2', 1000, 'SLOW'],
      ['ether3', null, 'NO_LINK'],
      ['ether4', 100, 'PORT_MISSING']
    ]);
  });

  it('[MON-140] should report a router that does not answer and still show the others', async () => {
    await seedRouter(prisma, {
      name: 'A Down',
      deviceModelId: routerboardId,
      ip: '10.0.0.1'
    });
    await seedRouter(prisma, {
      name: 'B Up',
      deviceModelId: routerboardId,
      ip: '10.0.0.2'
    });
    reader.answer(
      '10.0.0.1',
      Result.fail('RouterOS API error: timeout')
    );
    reader.serve('10.0.0.2', [linkedPort('ether1', 1000)]);

    const result = await list();

    expect(
      result.value.routers.map((r) => [
        r.name,
        r.error,
        r.ports.length
      ])
    ).toEqual([
      ['A Down', 'RouterOS API error: timeout', 0],
      ['B Up', null, 1]
    ]);
  });

  it('[MON-145] should list a router without an address or login with the reason', async () => {
    await seedRouter(prisma, {
      name: 'No IP',
      deviceModelId: routerboardId,
      ip: null
    });
    await seedRouter(prisma, {
      name: 'No login',
      deviceModelId: routerboardId,
      login: null
    });

    const result = await list();

    expect(
      result.value.routers.map((r) => [r.name, r.readable, r.reason])
    ).toEqual([
      ['No IP', false, 'The router has no IP address'],
      [
        'No login',
        false,
        'The router has no username and password saved'
      ]
    ]);
    expect(reader.reads).toEqual([]);
  });

  it('[MON-145] should not read any router when the server is off site', async () => {
    const agent = await seedAgent(prisma, { status: 'ACTIVE' });
    await seedRouter(prisma, {
      name: 'Behind agent',
      deviceModelId: routerboardId,
      agentId: agent.id
    });
    await seedRouter(prisma, {
      name: 'Unreached',
      deviceModelId: routerboardId
    });

    const result = await list(false);

    expect(result.value.routers.map((r) => r.reason)).toEqual([
      'Behind an on-site agent: reading ports through an agent is not supported yet',
      'This server is off site and no agent reaches the router'
    ]);
    expect(reader.reads).toEqual([]);
  });

  it('[MON-145] should read a router behind an agent itself when on site', async () => {
    const agent = await seedAgent(prisma, { status: 'ACTIVE' });
    await seedRouter(prisma, {
      name: 'Behind agent',
      deviceModelId: routerboardId,
      ip: '10.0.0.1',
      agentId: agent.id
    });
    reader.serve('10.0.0.1', []);

    const result = await list();

    expect(result.value.routers[0]!.readable).toBe(true);
    expect(reader.reads).toHaveLength(1);
  });

  it('should answer an empty list when there are no MikroTiks', async () => {
    const result = await list();

    expect(result.value.routers).toEqual([]);
  });
});
