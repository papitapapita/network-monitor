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
import {
  RunScheduledDiscoveryUseCase,
  SCAN_NEEDS_SERVER_ON_SITE
} from 'application/device-inventory/use-cases';
import { PrismaDiscoverySettingsRepository } from 'infrastructure/persistence';
import {
  AGENT_SCAN_NOT_AVAILABLE,
  SegmentScanner
} from 'infrastructure/monitoring/network-scanner';

const NOW = new Date('2026-11-03T12:00:00Z');
const AGENT = '0b9c6f0e-3f4a-4c55-9a51-6f7d2a1c8e10';

describe('RunScheduledDiscoveryUseCase — integration', () => {
  let prisma: PrismaClient;
  let scanner: FakeNetworkScannerService;
  let notifier: FakeDiscoveryNotifier;

  function makeUseCase(
    serverOnSite = true
  ): RunScheduledDiscoveryUseCase {
    return new RunScheduledDiscoveryUseCase(
      new PrismaDiscoverySettingsRepository(prisma),
      new SegmentScanner(scanner),
      makeSightingRecorder(prisma, notifier),
      serverOnSite
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
    notifier = new FakeDiscoveryNotifier();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    scanner.reset();
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

    expect(result.value).toEqual({ ran: false, segments: [] });
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
    await saveSettings({
      segments: [
        { cidr: '10.0.0.0/24', agentId: AGENT },
        { cidr: '192.168.1.0/24', agentId: null }
      ]
    });

    const result = await makeUseCase().execute({ now: NOW });

    expect(result.value.segments.map((s) => s.error)).toEqual([
      AGENT_SCAN_NOT_AVAILABLE,
      null
    ]);
  });

  it('[DEV-212] off site, a server segment is not swept', async () => {
    await saveSettings({});

    const result = await makeUseCase(false).execute({ now: NOW });

    expect(result.value.segments[0].error).toBe(
      SCAN_NEEDS_SERVER_ON_SITE
    );
    expect(scanner.callCount).toBe(0);
  });
});
