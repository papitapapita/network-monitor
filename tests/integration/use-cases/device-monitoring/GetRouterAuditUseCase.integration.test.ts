// Source: src/application/device-monitoring/use-cases/GetRouterAuditUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import { cleanDatabase } from '../../helpers/db';
import {
  factorySecurity,
  FakeRouterOsPrinter,
  rb4011
} from '../../helpers/FakeRouterOsPrinter';
import {
  seedMikrotikModel,
  seedRouter
} from '../../helpers/portSpeeds';
import {
  buildRouterSystems,
  systemStateOf
} from '../../helpers/routerSystems';

// An RB4011 left on RouterOS 6 with older RouterBOARD firmware.
function oldRb4011() {
  const served = rb4011('Torre-Norte', 'D4440E1A9999');
  return {
    ...served,
    '/system/resource/print': [
      {
        ...served['/system/resource/print']![0],
        version: '6.49.10 (long-term)'
      }
    ],
    '/system/routerboard/print': [
      {
        ...served['/system/routerboard/print']![0],
        'current-firmware': '6.47',
        'upgrade-firmware': '6.49.10'
      }
    ]
  };
}

describe('GetRouterAuditUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let modelId: string;
  const printer = new FakeRouterOsPrinter();

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    printer.reset();
    await cleanDatabase(prisma);
    modelId = await seedMikrotikModel(prisma);
  });

  it('[MON-186] should list what the scheduled check read, oldest RouterOS first, reading nothing itself', async () => {
    const coreId = await seedRouter(prisma, {
      name: 'Core',
      deviceModelId: modelId,
      ip: '10.0.0.1'
    });
    const northId = await seedRouter(prisma, {
      name: 'Torre Norte',
      deviceModelId: modelId,
      ip: '10.0.0.2'
    });
    printer.serve('10.0.0.1', rb4011());
    printer.serve('10.0.0.2', {
      ...oldRb4011(),
      ...factorySecurity()
    });
    const systems = buildRouterSystems(prisma, printer);
    await systems.check.execute({ now: systems.now });
    const batches = printer.batches.length;

    const result = await systems.audit.execute();

    expect(printer.batches).toHaveLength(batches);
    expect(result.value.routers).toEqual([
      {
        deviceId: northId,
        name: 'Torre Norte',
        ipAddress: '10.0.0.2',
        readable: true,
        reason: null,
        readAt: systems.now.toISOString(),
        lastError: null,
        routerOsVersion: '6.49.10',
        currentFirmware: '6.47',
        upgradeFirmware: '6.49.10',
        findings: [
          { code: 'FIRMWARE_BEHIND', service: null, port: null },
          { code: 'PLAINTEXT_SERVICE', service: 'telnet', port: 23 },
          {
            code: 'UNRESTRICTED_SERVICE',
            service: 'telnet',
            port: 23
          },
          {
            code: 'UNRESTRICTED_SERVICE',
            service: 'api',
            port: 8728
          },
          { code: 'ADMIN_USER', service: null, port: null },
          {
            code: 'DISCOVERY_ON_ALL_INTERFACES',
            service: null,
            port: null
          }
        ],
        unchecked: []
      },
      expect.objectContaining({
        deviceId: coreId,
        routerOsVersion: '7.15.3',
        findings: [],
        unchecked: ['SERVICES', 'USERS', 'DISCOVERY']
      })
    ]);
  });

  it('[MON-180] should keep the security reads with the reading', async () => {
    const coreId = await seedRouter(prisma, {
      name: 'Core',
      deviceModelId: modelId,
      ip: '10.0.0.1'
    });
    printer.serve('10.0.0.1', { ...rb4011(), ...factorySecurity() });
    const systems = buildRouterSystems(prisma, printer);

    await systems.check.execute({ now: systems.now });

    expect((await systemStateOf(prisma, coreId))?.security).toEqual({
      services: [
        {
          name: 'telnet',
          port: 23,
          enabled: true,
          allowedAddresses: []
        },
        {
          name: 'winbox',
          port: 8291,
          enabled: true,
          allowedAddresses: ['10.0.0.0/24']
        },
        {
          name: 'api',
          port: 8728,
          enabled: true,
          allowedAddresses: []
        },
        {
          name: 'ftp',
          port: 21,
          enabled: false,
          allowedAddresses: []
        }
      ],
      userNames: ['admin'],
      discoveryInterfaceList: 'all'
    });
  });

  it('[MON-180] should keep the last findings while the router does not answer', async () => {
    await seedRouter(prisma, {
      name: 'Core',
      deviceModelId: modelId,
      ip: '10.0.0.1'
    });
    printer.serve('10.0.0.1', { ...rb4011(), ...factorySecurity() });
    const systems = buildRouterSystems(prisma, printer);
    await systems.check.execute({ now: systems.now });
    printer.refuse('10.0.0.1', 'RouterOS API error: timeout');
    await systems.check.execute({
      now: new Date(systems.now.getTime() + 600_000)
    });

    const [router] = (await systems.audit.execute()).value.routers;

    expect(router).toMatchObject({
      readAt: systems.now.toISOString(),
      lastError: 'RouterOS API error: timeout'
    });
    expect(router!.findings.map((f) => f.code)).toContain(
      'ADMIN_USER'
    );
  });

  it('[MON-186] should list a router never read, and one that cannot be read, with nothing checked', async () => {
    await seedRouter(prisma, {
      name: 'Sin IP',
      deviceModelId: modelId,
      ip: null
    });

    const result = await buildRouterSystems(
      prisma,
      printer
    ).audit.execute();

    expect(result.value.routers).toEqual([
      expect.objectContaining({
        name: 'Sin IP',
        readable: false,
        readAt: null,
        findings: [],
        unchecked: ['SERVICES', 'USERS', 'DISCOVERY']
      })
    ]);
  });

  it('[MON-186] should treat a stored security part it cannot understand as unchecked', async () => {
    const coreId = await seedRouter(prisma, {
      name: 'Core',
      deviceModelId: modelId,
      ip: '10.0.0.1'
    });
    printer.serve('10.0.0.1', { ...rb4011(), ...factorySecurity() });
    const systems = buildRouterSystems(prisma, printer);
    await systems.check.execute({ now: systems.now });
    await prisma.routerSystemState.update({
      where: { deviceId: coreId },
      data: {
        security: {
          userNames: 'admin',
          discoveryInterfaceList: 'all'
        }
      }
    });

    const [router] = (await systems.audit.execute()).value.routers;

    expect(router!.unchecked).toEqual(['SERVICES', 'USERS']);
    expect(router!.findings.map((f) => f.code)).toEqual([
      'DISCOVERY_ON_ALL_INTERFACES'
    ]);
  });
});
