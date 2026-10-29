// Source: src/application/device-inventory/use-cases/RunScheduledDiscoveryUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import {
  createTestPrisma,
  cleanDatabase,
  seedDeviceModel
} from '../../helpers/db';
import {
  FakeDiscoveryNotifier,
  makeSightingRecorder,
  seedOwnedDevice
} from '../../helpers/discoveredDevices';
import { FakeNetworkScannerService } from '../../helpers/FakeNetworkScannerService';
import { FakeAgentHostDiscovery } from '../../helpers/FakeAgentHostDiscovery';
import {
  RunScheduledDiscoveryUseCase,
  SCAN_NEEDS_SERVER_ON_SITE
} from 'application/device-inventory/use-cases';
import { PrismaDiscoverySettingsRepository } from 'infrastructure/persistence';
import { SegmentScanner } from 'infrastructure/monitoring/network-scanner';
import { PrismaPortSpeedTargetsQuery } from 'infrastructure/monitoring/port-speeds';
import { RouterNeighborQueryAdapter } from 'infrastructure/monitoring/router-neighbors';
import { RouterNeighborSurvey } from 'application/device-monitoring/services';
import {
  FakeRouterNeighborReader,
  neighbor
} from '../../helpers/FakeRouterNeighborReader';
import {
  seedMikrotikModel,
  seedRouter
} from '../../helpers/portSpeeds';

const NOW = new Date('2026-11-03T12:00:00Z');
const AGENT = '0b9c6f0e-3f4a-4c55-9a51-6f7d2a1c8e10';

describe('RunScheduledDiscoveryUseCase — integration', () => {
  let prisma: PrismaClient;
  let scanner: FakeNetworkScannerService;
  let agents: FakeAgentHostDiscovery;
  let notifier: FakeDiscoveryNotifier;

  const neighbors = new FakeRouterNeighborReader();

  function makeUseCase(
    serverOnSite = true,
    readRouters = false
  ): RunScheduledDiscoveryUseCase {
    return new RunScheduledDiscoveryUseCase(
      new PrismaDiscoverySettingsRepository(prisma),
      new SegmentScanner(scanner, agents),
      makeSightingRecorder(prisma, notifier),
      serverOnSite,
      readRouters
        ? new RouterNeighborQueryAdapter(
            new RouterNeighborSurvey(
              new PrismaPortSpeedTargetsQuery(prisma, serverOnSite),
              neighbors
            )
          )
        : null
    );
  }

  async function saveSettings(data: {
    enabled?: boolean;
    intervalHours?: number;
    segments?: { cidr: string; agentId: string | null }[];
    lastRunAt?: Date | null;
  }): Promise<void> {
    await prisma.discoverySettings.create({
      data: {
        enabled: data.enabled ?? true,
        intervalHours: data.intervalHours ?? 24,
        segments: data.segments ?? [
          { cidr: '192.168.1.0/24', agentId: null }
        ],
        lastRunAt: data.lastRunAt ?? null
      }
    });
  }

  beforeAll(() => {
    prisma = createTestPrisma();
    scanner = new FakeNetworkScannerService();
    agents = new FakeAgentHostDiscovery();
    notifier = new FakeDiscoveryNotifier();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    neighbors.reset();
    scanner.reset();
    agents.reset();
    notifier.reset();
    scanner.setHosts([
      {
        ipAddress: '192.168.1.20',
        latencyMs: 3,
        macAddress: 'AA:BB:CC:DD:EE:01',
        manufacturer: 'Ubiquiti Inc'
      },
      {
        ipAddress: '192.168.1.1',
        latencyMs: 1,
        macAddress: 'AA:BB:CC:DD:EE:02',
        manufacturer: 'Routerboard.com'
      }
    ]);
  });

  it('[DEV-211] does nothing before the settings are saved', async () => {
    const result = await makeUseCase().execute({ now: NOW });

    expect(result.value).toEqual({
      ran: false,
      segments: [],
      routers: []
    });
    expect(scanner.callCount).toBe(0);
  });

  it('[DEV-211] a due run stamps itself and records what is new', async () => {
    await saveSettings({});
    const modelId = await seedDeviceModel(prisma);
    await seedOwnedDevice(prisma, modelId, {
      macAddress: 'AA:BB:CC:DD:EE:02'
    });

    const result = await makeUseCase().execute({ now: NOW });

    expect(result.value.segments).toEqual([
      {
        cidr: '192.168.1.0/24',
        agentId: null,
        responsiveCount: 2,
        newCount: 1,
        error: null
      }
    ]);
    const row = await prisma.discoverySettings.findUniqueOrThrow({
      where: { id: 1 }
    });
    expect(row.lastRunAt).toEqual(NOW);
    const stored = await prisma.discoveredDevice.findMany();
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      macAddress: 'AA:BB:CC:DD:EE:01',
      source: 'SCAN',
      segment: '192.168.1.0/24',
      lastSeenAt: NOW
    });
    expect(notifier.notices).toEqual([
      { count: 1, where: '192.168.1.0/24', occurredAt: NOW }
    ]);
  });

  it('[DEV-211] the run after it waits for the interval', async () => {
    await saveSettings({ intervalHours: 6 });
    await makeUseCase().execute({ now: NOW });

    const soon = await makeUseCase().execute({
      now: new Date(NOW.getTime() + 5 * 3_600_000)
    });
    const later = await makeUseCase().execute({
      now: new Date(NOW.getTime() + 6 * 3_600_000)
    });

    expect(soon.value.ran).toBe(false);
    expect(later.value.ran).toBe(true);
    expect(scanner.callCount).toBe(2);
  });

  it('[DEV-212] a segment the scanner rejects is reported, the run goes on', async () => {
    agents.failWith('The agent is not connected');
    await saveSettings({
      segments: [
        { cidr: '10.0.0.0/24', agentId: AGENT },
        { cidr: '192.168.1.0/24', agentId: null }
      ]
    });

    const result = await makeUseCase().execute({ now: NOW });

    expect(result.value.segments.map((s) => s.error)).toEqual([
      'The agent could not scan: The agent is not connected',
      null
    ]);
  });

  it('[DEV-214] an agent segment is swept by its agent, even off site', async () => {
    agents.setHosts([
      {
        ipAddress: '10.0.0.7',
        macAddress: 'AA:BB:CC:DD:EE:07',
        latencyMs: 5
      }
    ]);
    await saveSettings({
      segments: [{ cidr: '10.0.0.0/24', agentId: AGENT }]
    });

    const result = await makeUseCase(false).execute({ now: NOW });

    expect(agents.calls).toEqual([
      { agentId: AGENT, cidr: '10.0.0.0/24' }
    ]);
    expect(scanner.callCount).toBe(0);
    expect(result.value.segments[0].error).toBeNull();
    const stored = await prisma.discoveredDevice.findMany();
    expect(stored.map((d) => [d.macAddress, d.segment])).toEqual([
      ['AA:BB:CC:DD:EE:07', '10.0.0.0/24']
    ]);
    expect(notifier.notices).toHaveLength(1);
  });

  it('[DEV-212] off site, a server segment is not swept', async () => {
    await saveSettings({});

    const result = await makeUseCase(false).execute({ now: NOW });

    expect(result.value.segments[0].error).toBe(
      SCAN_NEEDS_SERVER_ON_SITE
    );
    expect(scanner.callCount).toBe(0);
  });

  describe('router neighbours (DEV-217)', () => {
    it('[DEV-217] what a router hears and inventory lacks becomes a suggestion', async () => {
      await saveSettings({ segments: [] });
      const modelId = await seedMikrotikModel(prisma);
      const hex = await seedRouter(prisma, {
        name: 'Hex Norte',
        deviceModelId: modelId,
        ip: '10.0.7.1'
      });
      neighbors.serve('10.0.7.1', [
        neighbor('ether2 AP 32', {
          macAddress: '24:A4:3C:00:00:01',
          ipAddress: '10.0.7.21',
          identity: 'Virgüez',
          platform: 'LiteBeam M5'
        }),
        // the router itself, heard back over the bridge: inventory has it
        neighbor('ether1', { ipAddress: '10.0.7.1' })
      ]);

      const result = await makeUseCase(true, true).execute({
        now: NOW
      });

      expect(result.value).toEqual({
        ran: true,
        segments: [],
        routers: [
          {
            deviceId: hex,
            name: 'Hex Norte',
            neighborCount: 2,
            newCount: 1,
            error: null
          }
        ]
      });
      const stored = await prisma.discoveredDevice.findMany();
      expect(stored).toHaveLength(1);
      expect(stored[0]).toMatchObject({
        macAddress: '24:A4:3C:00:00:01',
        ipAddress: '10.0.7.21',
        source: 'ROUTER_NEIGHBOR',
        segment: null,
        hostname: 'Virgüez',
        model: 'LiteBeam M5',
        lastSeenAt: NOW
      });
      expect(notifier.notices).toEqual([
        { count: 1, where: 'Hex Norte', occurredAt: NOW }
      ]);
    });

    it('[DEV-217] a router that cannot be read is reported, the run goes on', async () => {
      await saveSettings({});
      const modelId = await seedMikrotikModel(prisma);
      const hex = await seedRouter(prisma, {
        name: 'Hex Norte',
        deviceModelId: modelId,
        login: null
      });

      const result = await makeUseCase(true, true).execute({
        now: NOW
      });

      expect(result.value.segments[0]!.error).toBeNull();
      expect(result.value.routers).toEqual([
        {
          deviceId: hex,
          name: 'Hex Norte',
          neighborCount: null,
          newCount: null,
          error: 'The router has no username and password saved'
        }
      ]);
      expect(neighbors.reads).toHaveLength(0);
    });
  });
});
