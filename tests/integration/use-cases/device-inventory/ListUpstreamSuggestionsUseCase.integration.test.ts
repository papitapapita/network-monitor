// Source: src/application/device-inventory/use-cases/ListUpstreamSuggestionsUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import { Result } from '../../../../src/domain/shared/core';
import { ListUpstreamSuggestionsUseCase } from 'application/device-inventory/use-cases';
import {
  PoweredDeviceSurvey,
  SitePoeInspector
} from 'application/power-control';
import { RouterSurvey } from 'application/device-monitoring/services';
import {
  PrismaKnownDeviceLookup,
  PrismaReportedApQuery,
  PrismaTopologyQuery
} from 'infrastructure/persistence';
import { PrismaPortSpeedTargetsQuery } from 'infrastructure/monitoring/port-speeds';
import { RouterNeighborQueryAdapter } from 'infrastructure/monitoring/router-neighbors';
import {
  PoweringSwitchQueryAdapter,
  PrismaPoeSwitchTargetsQuery
} from 'infrastructure/power-control';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import {
  cleanDatabase,
  seedWirelessDeviceModel,
  INVALID_ID
} from '../../helpers/db';
import {
  FakePoeSwitchReader,
  poweredPort
} from '../../helpers/FakePoeSwitchReader';
import {
  seedPoeSwitchModel,
  seedSite,
  seedSiteDevice
} from '../../helpers/powerControl';
import {
  FakeRouterNeighborReader,
  neighbor
} from '../../helpers/FakeRouterNeighborReader';
import {
  seedMikrotikModel,
  seedRouter
} from '../../helpers/portSpeeds';

const LOGIN = { username: 'admin', password: 'secret' };

describe('ListUpstreamSuggestionsUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: ListUpstreamSuggestionsUseCase;
  let switchModelId: string;
  let antennaModelId: string;
  let towerId: string;
  const reader = new FakePoeSwitchReader();
  const neighbors = new FakeRouterNeighborReader();

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();
    const targets = new PrismaPoeSwitchTargetsQuery(prisma, true);
    useCase = new ListUpstreamSuggestionsUseCase(
      new PrismaTopologyQuery(prisma, true),
      new PrismaReportedApQuery(prisma),
      new PoweringSwitchQueryAdapter(
        new PoweredDeviceSurvey(
          targets,
          new SitePoeInspector(targets, reader)
        )
      ),
      new RouterNeighborQueryAdapter(
        new RouterSurvey(
          new PrismaPortSpeedTargetsQuery(prisma, true),
          neighbors
        )
      ),
      new PrismaKnownDeviceLookup(prisma),
      new WinstonLogger()
    );
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    reader.reset();
    neighbors.reset();
    await cleanDatabase(prisma);
    switchModelId = await seedPoeSwitchModel(prisma, 'ROUTEROS');
    antennaModelId = await seedWirelessDeviceModel(prisma);
    towerId = await seedSite(prisma, 'Torre Norte');
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

  const seedSwitch = (
    name: string,
    ip: string,
    locationId = towerId
  ) =>
    seedSiteDevice(prisma, {
      name,
      deviceModelId: switchModelId,
      locationId,
      ip,
      login: LOGIN
    });

  async function makeStation(
    deviceId: string,
    ip: string
  ): Promise<void> {
    await prisma.wirelessPollingConfiguration.create({
      data: {
        deviceId,
        ipAddress: ip,
        enabled: true,
        intervalSecs: 300,
        deviceType: 'STATION'
      }
    });
  }

  async function snapshot(
    deviceId: string,
    collectedAt: Date,
    remote: { apDeviceId?: string | null; apIp?: string | null }
  ): Promise<void> {
    await prisma.wirelessSnapshot.create({
      data: {
        deviceId,
        deviceType: 'STATION',
        collectedAt,
        collectionMethod: 'HTTP',
        remoteApDeviceId: remote.apDeviceId ?? null,
        remoteApIp: remote.apIp ?? null
      }
    });
  }

  describe('stations (DEV-190)', () => {
    it('[DEV-190] suggests the AP named by the latest reading', async () => {
      const oldAp = await seedAntenna('AP Vieja', '10.0.3.1');
      const ap = await seedAntenna('AP Norte', '10.0.3.2');
      const sta = await seedAntenna('CPE Juan', '10.0.3.21');
      await makeStation(sta, '10.0.3.21');
      await snapshot(sta, new Date('2026-10-28T10:00:00Z'), {
        apDeviceId: oldAp
      });
      const latest = new Date('2026-10-29T10:00:00Z');
      await snapshot(sta, latest, { apDeviceId: ap });

      const result = await useCase.execute({});

      expect(result.isSuccess).toBe(true);
      expect(result.value.suggestions).toEqual([
        {
          deviceId: sta,
          deviceName: 'CPE Juan',
          ipAddress: '10.0.3.21',
          locationName: 'Torre Norte',
          currentUpstreamDeviceId: null,
          currentUpstreamDeviceName: null,
          suggestedUpstreamDeviceId: ap,
          suggestedUpstreamDeviceName: 'AP Norte',
          source: 'WIRELESS',
          matchedBy: 'MAC',
          observedAt: latest.toISOString(),
          port: null
        }
      ]);
    });

    it('[DEV-190] falls back to the AP IP the radio reports', async () => {
      const ap = await seedAntenna('AP Norte', '10.0.3.2');
      const sta = await seedAntenna('CPE Juan', '10.0.3.21');
      await makeStation(sta, '10.0.3.21');
      await snapshot(sta, new Date(), { apIp: '10.0.3.2' });

      const result = await useCase.execute({});

      expect(result.value.suggestions).toMatchObject([
        {
          deviceId: sta,
          suggestedUpstreamDeviceId: ap,
          matchedBy: 'IP'
        }
      ]);
    });

    it('[DEV-192] offers nothing when the station already hangs off that AP', async () => {
      const ap = await seedAntenna('AP Norte', '10.0.3.2');
      const sta = await seedAntenna('CPE Juan', '10.0.3.21');
      await prisma.device.update({
        where: { id: sta },
        data: { upstreamDeviceId: ap }
      });
      await makeStation(sta, '10.0.3.21');
      await snapshot(sta, new Date(), { apDeviceId: ap });

      const result = await useCase.execute({});

      expect(result.value.total).toBe(0);
    });
  });

  describe('PoE switches (DEV-191)', () => {
    it('[DEV-191] suggests the switch whose port powers the antenna', async () => {
      const sw = await seedSwitch('Hex Norte', '10.0.5.2');
      const ap = await seedAntenna('AP Norte', '10.0.5.21');
      reader.serve('10.0.5.2', [poweredPort('ether2', '10.0.5.21')]);

      const result = await useCase.execute({});

      expect(result.value.suggestions).toMatchObject([
        {
          deviceId: ap,
          suggestedUpstreamDeviceId: sw,
          suggestedUpstreamDeviceName: 'Hex Norte',
          source: 'POE',
          port: 'ether2'
        }
      ]);
      expect(result.value.unreadSwitches).toEqual([]);
    });

    it('[DEV-191] does not offer a PoE switch to a station', async () => {
      await seedSwitch('Hex Norte', '10.0.5.2');
      const sta = await seedAntenna('Backhaul B', '10.0.5.21');
      await makeStation(sta, '10.0.5.21');
      reader.serve('10.0.5.2', [poweredPort('ether2', '10.0.5.21')]);

      const result = await useCase.execute({});

      expect(result.value.total).toBe(0);
    });

    it('[DEV-195] lists a switch that could not be read', async () => {
      const sw = await seedSwitch('Hex Norte', '10.0.5.2');
      reader.answer('10.0.5.2', Result.fail('timeout'));

      const result = await useCase.execute({});

      expect(result.value.unreadSwitches).toEqual([
        { deviceId: sw, name: 'Hex Norte', reason: 'timeout' }
      ]);
    });

    it('[DEV-195] reads every site that has a switch', async () => {
      const southId = await seedSite(prisma, 'Torre Sur');
      await seedSwitch('Hex Norte', '10.0.5.2');
      await seedSwitch('Hex Sur', '10.0.6.2', southId);
      const apSouth = await seedAntenna(
        'AP Sur',
        '10.0.6.21',
        southId
      );
      reader.serve('10.0.5.2', []);
      reader.serve('10.0.6.2', [poweredPort('ether3', '10.0.6.21')]);

      const result = await useCase.execute({});

      expect(reader.reads.map((r) => r.host).sort()).toEqual([
        '10.0.5.2',
        '10.0.6.2'
      ]);
      expect(result.value.suggestions.map((s) => s.deviceId)).toEqual(
        [apSouth]
      );
    });
  });

  describe('location filter (DEV-195)', () => {
    it('[DEV-195] reads only the switches and devices at that location', async () => {
      const southId = await seedSite(prisma, 'Torre Sur');
      await seedSwitch('Hex Norte', '10.0.5.2');
      const ap = await seedAntenna('AP Norte', '10.0.5.21');
      await seedSwitch('Hex Sur', '10.0.6.2', southId);
      const sta = await seedAntenna('CPE Sur', '10.0.6.40', southId);
      await makeStation(sta, '10.0.6.40');
      await snapshot(sta, new Date(), { apDeviceId: ap });
      reader.serve('10.0.6.2', []);

      const result = await useCase.execute({ locationId: southId });

      expect(reader.reads.map((r) => r.host)).toEqual(['10.0.6.2']);
      expect(result.value.suggestions.map((s) => s.deviceId)).toEqual(
        [sta]
      );
    });

    it('refuses a malformed location id', async () => {
      const result = await useCase.execute({
        locationId: INVALID_ID
      });

      expect(result.error).toContain('Invalid location ID');
    });
  });

  describe('router neighbours (DEV-196, DEV-197)', () => {
    let routerModelId: string;

    beforeEach(async () => {
      routerModelId = await seedMikrotikModel(prisma);
    });

    const seedHex = (name = 'Hex Norte', ip = '10.0.7.1') =>
      seedRouter(prisma, { name, deviceModelId: routerModelId, ip });

    it('[DEV-196] suggests the router port that hears one device over its cable', async () => {
      const hex = await seedHex();
      const ap = await seedAntenna('AP 32', '10.0.7.21');
      neighbors.serve('10.0.7.1', [
        neighbor('ether2 AP 32', { ipAddress: '10.0.7.21' }),
        neighbor('ether2 AP 32', {
          ipAddress: '10.0.7.99',
          remoteInterface: 'ath0'
        })
      ]);

      const result = await useCase.execute({});

      expect(result.value.suggestions).toMatchObject([
        {
          deviceId: ap,
          suggestedUpstreamDeviceId: hex,
          suggestedUpstreamDeviceName: 'Hex Norte',
          source: 'ROUTER_NEIGHBOR',
          port: 'ether2 AP 32'
        }
      ]);
      expect(result.value.unreadRouters).toEqual([]);
    });

    it('[DEV-197] offers nothing on a port that hears several devices', async () => {
      await seedHex();
      await seedAntenna('AP 32', '10.0.7.21');
      await seedAntenna('AP 03', '10.0.7.22');
      neighbors.serve('10.0.7.1', [
        neighbor('ether1', { ipAddress: '10.0.7.21' }),
        neighbor('ether1', { ipAddress: '10.0.7.22' })
      ]);

      const result = await useCase.execute({});

      expect(result.value.total).toBe(0);
    });

    it('[DEV-197] offers nothing on the port that hears the gateway', async () => {
      await seedHex();
      const core = await seedRouter(prisma, {
        name: 'Core',
        deviceModelId: routerModelId,
        ip: '10.0.7.254',
        category: 'GATEWAY'
      });
      neighbors.serve('10.0.7.1', [
        neighbor('ether1', { ipAddress: '10.0.7.254' })
      ]);
      neighbors.serve('10.0.7.254', []);

      const result = await useCase.execute({});

      expect(
        result.value.suggestions.map((s) => s.deviceId)
      ).not.toContain(core);
      expect(result.value.total).toBe(0);
    });

    it('[DEV-196] lists a router that could not be read', async () => {
      const hex = await seedHex();
      neighbors.answer('10.0.7.1', Result.fail('timeout'));

      const result = await useCase.execute({});

      expect(result.value.unreadRouters).toEqual([
        { deviceId: hex, name: 'Hex Norte', reason: 'timeout' }
      ]);
    });
  });

  it('returns nothing on an empty network', async () => {
    const result = await useCase.execute({});

    expect(result.value).toEqual({
      suggestions: [],
      total: 0,
      unreadSwitches: [],
      unreadRouters: []
    });
  });
});
