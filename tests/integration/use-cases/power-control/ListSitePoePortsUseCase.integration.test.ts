// Source: src/application/power-control/use-cases/ListSitePoePortsUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import { Result } from '../../../../src/domain/shared/core';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import {
  cleanDatabase,
  seedAgent,
  seedWirelessDeviceModel,
  GHOST_ID,
  INVALID_ID
} from '../../helpers/db';
import {
  FakePoeSwitchReader,
  poweredPort
} from '../../helpers/FakePoeSwitchReader';
import {
  buildPowerControl,
  seedPoeSwitchModel,
  seedSite,
  seedSiteDevice
} from '../../helpers/powerControl';

const LOGIN = { username: 'admin', password: 'secret' };

describe('ListSitePoePortsUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let hexModelId: string;
  let cssModelId: string;
  let antennaModelId: string;
  let towerId: string;
  const reader = new FakePoeSwitchReader();

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
    hexModelId = await seedPoeSwitchModel(prisma, 'ROUTEROS');
    cssModelId = await seedPoeSwitchModel(prisma, 'SWOS');
    antennaModelId = await seedWirelessDeviceModel(prisma);
    towerId = await seedSite(prisma, 'Torre Norte');
  });

  const list = (locationId = towerId, serverOnSite = true) =>
    buildPowerControl(prisma, reader, {
      serverOnSite
    }).listSitePorts.execute({ locationId });

  const seedHex = (name: string, ip: string | null, extra = {}) =>
    seedSiteDevice(prisma, {
      name,
      deviceModelId: hexModelId,
      locationId: towerId,
      ip,
      login: LOGIN,
      ...extra
    });

  const seedAntenna = (
    name: string,
    ip: string,
    locationId: string | null = towerId
  ) =>
    seedSiteDevice(prisma, {
      name,
      deviceModelId: antennaModelId,
      locationId,
      ip
    });

  it('[PWR-031] should match each port to the antenna its label names', async () => {
    const hexId = await seedHex('hEX Torre Norte', '10.0.5.2');
    const rocketId = await seedAntenna('Rocket Norte', '10.0.5.21');
    reader.serve('10.0.5.2', [
      poweredPort('ether2', '10.0.5.21'),
      poweredPort('ether3', 'spare')
    ]);

    const result = await list();

    expect(result.value).toEqual({
      locationId: towerId,
      locationName: 'Torre Norte',
      switches: [
        {
          deviceId: hexId,
          name: 'hEX Torre Norte',
          ipAddress: '10.0.5.2',
          firmware: 'ROUTEROS',
          firmwareVersion: '7.15.3',
          readable: true,
          reason: null,
          error: null,
          ports: [
            {
              port: 'ether2',
              label: '10.0.5.21',
              mode: 'AUTO',
              status: 'POWERED',
              powerWatts: 6.1,
              voltage: 24.1,
              match: {
                kind: 'MATCHED',
                ip: '10.0.5.21',
                deviceId: rocketId,
                deviceName: 'Rocket Norte',
                deviceLocationName: 'Torre Norte'
              }
            },
            {
              port: 'ether3',
              label: 'spare',
              mode: 'AUTO',
              status: 'POWERED',
              powerWatts: 6.1,
              voltage: 24.1,
              match: {
                kind: 'UNMATCHED',
                ip: null,
                deviceId: null,
                deviceName: null,
                deviceLocationName: null
              }
            }
          ]
        }
      ]
    });
  });

  it('[PWR-012] should read each switch with its saved login and firmware', async () => {
    await seedHex('hEX', '10.0.5.2');
    await seedSiteDevice(prisma, {
      name: 'CSS',
      deviceModelId: cssModelId,
      locationId: towerId,
      ip: '10.0.5.3',
      login: LOGIN,
      httpPort: 80
    });
    reader.serve('10.0.5.2', []);
    reader.serve('10.0.5.3', [], '2.13');

    await list();

    expect(reader.reads).toEqual(
      expect.arrayContaining([
        {
          host: '10.0.5.2',
          firmware: 'ROUTEROS',
          login: { ...LOGIN, apiPort: 8728, httpPort: 443 }
        },
        {
          host: '10.0.5.3',
          firmware: 'SWOS',
          login: { ...LOGIN, apiPort: 8728, httpPort: 80 }
        }
      ])
    );
  });

  it('[PWR-032] should warn when the antenna is recorded at another site', async () => {
    const otherSite = await seedSite(prisma, 'Torre Sur');
    await seedHex('hEX', '10.0.5.2');
    await seedAntenna('Rocket Sur', '10.0.5.21', otherSite);
    reader.serve('10.0.5.2', [poweredPort('ether2', '10.0.5.21')]);

    const result = await list();

    expect(result.value.switches[0]!.ports[0]!.match).toMatchObject({
      kind: 'MATCHED_OTHER_LOCATION',
      deviceName: 'Rocket Sur',
      deviceLocationName: 'Torre Sur'
    });
  });

  it('[PWR-033] should flag the same IP on two switches as a duplicate', async () => {
    await seedHex('hEX A', '10.0.5.2');
    await seedHex('hEX B', '10.0.5.4');
    await seedAntenna('Rocket Norte', '10.0.5.21');
    reader.serve('10.0.5.2', [poweredPort('ether2', '10.0.5.21')]);
    reader.serve('10.0.5.4', [poweredPort('ether4', 'AP-10.0.5.21')]);

    const result = await list();

    const kinds = result.value.switches.flatMap((s) =>
      s.ports.map((p) => p.match.kind)
    );
    expect(kinds).toEqual(['DUPLICATE', 'DUPLICATE']);
  });

  it('[PWR-031] should leave a port unmatched when no device holds its IP', async () => {
    await seedHex('hEX', '10.0.5.2');
    reader.serve('10.0.5.2', [poweredPort('ether2', '10.0.5.99')]);

    const result = await list();

    expect(result.value.switches[0]!.ports[0]!.match).toEqual({
      kind: 'UNMATCHED',
      ip: '10.0.5.99',
      deviceId: null,
      deviceName: null,
      deviceLocationName: null
    });
  });

  it('[PWR-031] should not match a deleted device', async () => {
    await seedHex('hEX', '10.0.5.2');
    const rocketId = await seedAntenna('Rocket', '10.0.5.21');
    await prisma.device.update({
      where: { id: rocketId },
      data: { deletedAt: new Date() }
    });
    reader.serve('10.0.5.2', [poweredPort('ether2', '10.0.5.21')]);

    const result = await list();

    expect(result.value.switches[0]!.ports[0]!.match.kind).toBe(
      'UNMATCHED'
    );
  });

  it('[PWR-014] should still show the other switches when one does not answer', async () => {
    await seedHex('hEX A', '10.0.5.2');
    await seedHex('hEX B', '10.0.5.4');
    reader.answer(
      '10.0.5.2',
      Result.fail('RouterOS API error: timeout')
    );
    reader.serve('10.0.5.4', [poweredPort('ether2', 'spare')]);

    const result = await list();

    expect(result.value.switches).toEqual([
      expect.objectContaining({
        name: 'hEX A',
        readable: true,
        error: 'RouterOS API error: timeout',
        ports: []
      }),
      expect.objectContaining({
        name: 'hEX B',
        error: null,
        ports: [expect.objectContaining({ port: 'ether2' })]
      })
    ]);
  });

  it('[PWR-011] should list a switch with no login or no IP, without reading it', async () => {
    await seedHex('hEX no login', '10.0.5.2', { login: null });
    await seedHex('hEX no IP', null);

    const result = await list();

    expect(reader.reads).toEqual([]);
    expect(
      result.value.switches.map((s) => [s.name, s.readable, s.reason])
    ).toEqual([
      ['hEX no IP', false, 'The switch has no IP address'],
      [
        'hEX no login',
        false,
        'The switch has no username and password saved'
      ]
    ]);
  });

  it('[PWR-013] should not read a switch behind an agent from an off-site server', async () => {
    const agent = await seedAgent(prisma, { status: 'ACTIVE' });
    await seedHex('hEX', '10.0.5.2', { agentId: agent.id });

    const result = await list(towerId, false);

    expect(reader.reads).toEqual([]);
    expect(result.value.switches[0]!.reason).toMatch(
      /^Behind an on-site agent/
    );
  });

  it('[PWR-010] should only list PoE switches in service at the site', async () => {
    const otherSite = await seedSite(prisma, 'Torre Sur');
    await seedHex('hEX here', '10.0.5.2');
    await seedHex('hEX in stock', '10.0.5.3', {
      status: 'INVENTORY'
    });
    await seedSiteDevice(prisma, {
      name: 'hEX elsewhere',
      deviceModelId: hexModelId,
      locationId: otherSite,
      ip: '10.0.6.2',
      login: LOGIN
    });
    await seedAntenna('Rocket', '10.0.5.21');
    reader.serve('10.0.5.2', []);

    const result = await list();

    expect(result.value.switches.map((s) => s.name)).toEqual([
      'hEX here'
    ]);
  });

  it('should answer no switches for a site without any', async () => {
    const result = await list();

    expect(result.value.switches).toEqual([]);
  });

  it('should fail for an unknown location', async () => {
    const result = await list(GHOST_ID);

    expect(result.error).toBe('Location not found');
  });

  it('should fail for a malformed id', async () => {
    const result = await list(INVALID_ID);

    expect(result.error).toMatch(/^Invalid location ID/);
  });
});
