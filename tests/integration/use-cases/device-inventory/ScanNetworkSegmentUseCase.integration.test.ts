// Source: src/application/device-inventory/use-cases/ScanNetworkSegmentUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import {
  ScanNetworkSegmentUseCase,
  SCAN_AGENT_NOT_FOUND,
  SCAN_NEEDS_SERVER_ON_SITE
} from 'application/device-inventory/use-cases/ScanNetworkSegmentUseCase';
import { SegmentScanner } from 'infrastructure/monitoring/network-scanner';
import { PrismaAgentAssignmentQuery } from 'infrastructure/probe-agents/queries';
import { FakeAgentHostDiscovery } from '../../helpers/FakeAgentHostDiscovery';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import { FakeNetworkScannerService } from '../../helpers/FakeNetworkScannerService';
import {
  createTestPrisma,
  cleanDatabase,
  seedAgent,
  seedDeviceModel
} from '../../helpers/db';
import {
  FakeDiscoveryNotifier,
  makeSightingRecorder,
  seedDiscoveredDevice,
  seedOwnedDevice
} from '../../helpers/discoveredDevices';

describe('ScanNetworkSegmentUseCase — integration', () => {
  let prisma: PrismaClient;
  let scanner: FakeNetworkScannerService;
  let agents: FakeAgentHostDiscovery;
  let notifier: FakeDiscoveryNotifier;
  let useCase: ScanNetworkSegmentUseCase;

  beforeAll(() => {
    prisma = createTestPrisma();
    scanner = new FakeNetworkScannerService();
    agents = new FakeAgentHostDiscovery();
    notifier = new FakeDiscoveryNotifier();
    useCase = makeUseCase();
  });

  function makeUseCase(
    serverOnSite = true
  ): ScanNetworkSegmentUseCase {
    return new ScanNetworkSegmentUseCase(
      new SegmentScanner(scanner, agents),
      makeSightingRecorder(prisma, notifier),
      new PrismaAgentAssignmentQuery(prisma),
      new WinstonLogger(),
      serverOnSite
    );
  }

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    scanner.reset();
    agents.reset();
    notifier.reset();
    await cleanDatabase(prisma);
  });

  // ──────────────────────────────────────────────────────────────
  // Happy path
  // ──────────────────────────────────────────────────────────────

  it('reports the hosts the scanner discovered', async () => {
    scanner.setHosts([
      {
        ipAddress: '192.168.1.1',
        latencyMs: 2,
        macAddress: 'AA:BB:CC:DD:EE:01',
        manufacturer: 'MikroTik'
      },
      {
        ipAddress: '192.168.1.20',
        latencyMs: 8,
        macAddress: null,
        manufacturer: null
      }
    ]);

    const result = await useCase.execute({
      segment: '192.168.1.0/24'
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.segment).toBe('192.168.1.0/24');
    expect(result.value.responsiveCount).toBe(2);
    expect(result.value.discoveredHosts).toHaveLength(2);
    expect(result.value.discoveredHosts[0]).toMatchObject({
      ipAddress: '192.168.1.1',
      latencyMs: 2,
      macAddress: 'AA:BB:CC:DD:EE:01',
      manufacturer: 'MikroTik'
    });
  });

  it('passes the trimmed segment through to the scanner', async () => {
    await useCase.execute({ segment: '  10.0.0.0/24  ' });

    expect(scanner.callCount).toBe(1);
    expect(scanner.lastCidr).toBe('10.0.0.0/24');
  });

  it('succeeds with zero responsive hosts', async () => {
    scanner.setHosts([]);

    const result = await useCase.execute({
      segment: '192.168.99.0/24'
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.responsiveCount).toBe(0);
    expect(result.value.discoveredHosts).toHaveLength(0);
  });

  it('preserves a null MAC for hosts on another L2 segment', async () => {
    scanner.setHosts([
      {
        ipAddress: '10.1.2.3',
        latencyMs: 15,
        macAddress: null,
        manufacturer: null
      }
    ]);

    const result = await useCase.execute({ segment: '10.1.2.0/24' });

    expect(result.value.discoveredHosts[0].macAddress).toBeNull();
    expect(result.value.discoveredHosts[0].manufacturer).toBeNull();
  });

  // ──────────────────────────────────────────────────────────────
  // scannedCount — usable host arithmetic per prefix length
  // ──────────────────────────────────────────────────────────────

  it('[DEV-143] excludes network and broadcast addresses for a /24', async () => {
    const result = await useCase.execute({
      segment: '192.168.1.0/24'
    });

    expect(result.value.scannedCount).toBe(254);
  });

  it('[DEV-143] refuses a /16 before sweeping it', async () => {
    const result = await useCase.execute({ segment: '10.0.0.0/16' });

    expect(result.error).toBe(
      'Scan failed: CIDR range too large: maximum 1024 host addresses allowed'
    );
    expect(scanner.callCount).toBe(0);
  });

  it('[DEV-143] counts both addresses in a /31 point-to-point link', async () => {
    const result = await useCase.execute({ segment: '10.0.0.0/31' });

    expect(result.value.scannedCount).toBe(2);
  });

  it('[DEV-143] counts the single address in a /32', async () => {
    const result = await useCase.execute({ segment: '10.0.0.1/32' });

    expect(result.value.scannedCount).toBe(1);
  });

  it('[DEV-143] fails for a segment with no prefix', async () => {
    const result = await useCase.execute({ segment: '10.0.0.1' });

    expect(result.error).toContain(
      'Scan failed: Invalid CIDR format'
    );
  });

  it('[DEV-143] fails for an out-of-range prefix', async () => {
    const result = await useCase.execute({ segment: '10.0.0.0/33' });

    expect(result.error).toContain(
      'Scan failed: Invalid CIDR prefix'
    );
  });

  // ──────────────────────────────────────────────────────────────
  // Validation failures
  // ──────────────────────────────────────────────────────────────

  it('[DEV-143] fails when segment is empty', async () => {
    const result = await useCase.execute({ segment: '' });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/segment is required/i);
  });

  it('[DEV-143] fails when segment is only whitespace', async () => {
    const result = await useCase.execute({ segment: '   ' });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/segment is required/i);
  });

  it('does not invoke the scanner when validation fails', async () => {
    await useCase.execute({ segment: '' });

    expect(scanner.callCount).toBe(0);
  });

  // ──────────────────────────────────────────────────────────────
  // Sightings (DEV-200..207)
  // ──────────────────────────────────────────────────────────────

  describe('sightings', () => {
    const host = {
      ipAddress: '192.168.1.20',
      latencyMs: 3,
      macAddress: 'aa:bb:cc:dd:ee:20',
      manufacturer: 'Ubiquiti Inc'
    };

    it('[DEV-200] stores a host inventory lacks as a pending suggestion', async () => {
      scanner.setHosts([host]);

      const result = await useCase.execute({
        segment: '192.168.1.0/24'
      });

      const row = await prisma.discoveredDevice.findUniqueOrThrow({
        where: { macAddress: 'AA:BB:CC:DD:EE:20' }
      });
      expect(row).toMatchObject({
        ipAddress: '192.168.1.20',
        manufacturer: 'Ubiquiti Inc',
        source: 'SCAN',
        segment: '192.168.1.0/24',
        ignoredAt: null
      });
      expect(result.value.newCount).toBe(1);
      expect(result.value.discoveredHosts[0]).toMatchObject({
        knownDeviceId: null,
        discoveredDeviceId: row.id,
        isNew: true
      });
    });

    it('[DEV-200] stores nothing for a host with no MAC', async () => {
      scanner.setHosts([{ ...host, macAddress: null }]);

      await useCase.execute({ segment: '192.168.1.0/24' });

      expect(await prisma.discoveredDevice.count()).toBe(0);
    });

    it('[DEV-201] marks a host inventory has by MAC, storing nothing', async () => {
      const modelId = await seedDeviceModel(prisma);
      const deviceId = await seedOwnedDevice(prisma, modelId, {
        macAddress: 'AA:BB:CC:DD:EE:20'
      });
      scanner.setHosts([host]);

      const result = await useCase.execute({
        segment: '192.168.1.0/24'
      });

      expect(result.value.discoveredHosts[0]).toMatchObject({
        knownDeviceId: deviceId,
        discoveredDeviceId: null,
        isNew: false
      });
      expect(await prisma.discoveredDevice.count()).toBe(0);
    });

    it('[DEV-201] marks a host inventory has by IP', async () => {
      const modelId = await seedDeviceModel(prisma);
      const deviceId = await seedOwnedDevice(prisma, modelId, {
        ipAddress: '192.168.1.20'
      });
      scanner.setHosts([host]);

      const result = await useCase.execute({
        segment: '192.168.1.0/24'
      });

      expect(result.value.discoveredHosts[0].knownDeviceId).toBe(
        deviceId
      );
    });

    it('[DEV-201] a device in the recycle bin does not count as inventory', async () => {
      const modelId = await seedDeviceModel(prisma);
      await seedOwnedDevice(prisma, modelId, {
        macAddress: 'AA:BB:CC:DD:EE:20',
        deleted: true
      });
      scanner.setHosts([host]);

      const result = await useCase.execute({
        segment: '192.168.1.0/24'
      });

      expect(result.value.discoveredHosts[0].isNew).toBe(true);
    });

    it('[DEV-202] a second scan refreshes the suggestion without a new notice', async () => {
      scanner.setHosts([host]);
      await useCase.execute({ segment: '192.168.1.0/24' });
      scanner.setHosts([{ ...host, ipAddress: '192.168.1.21' }]);

      const result = await useCase.execute({
        segment: '192.168.1.0/24'
      });

      const rows = await prisma.discoveredDevice.findMany();
      expect(rows).toHaveLength(1);
      expect(rows[0].ipAddress).toBe('192.168.1.21');
      expect(result.value.newCount).toBe(0);
      expect(notifier.notices).toHaveLength(1);
    });

    it('[DEV-203] a scan clears a suggestion whose MAC inventory now owns', async () => {
      await seedDiscoveredDevice(prisma, {
        macAddress: 'AA:BB:CC:DD:EE:20'
      });
      const modelId = await seedDeviceModel(prisma);
      await seedOwnedDevice(prisma, modelId, {
        macAddress: 'AA:BB:CC:DD:EE:20'
      });
      scanner.setHosts([host]);

      await useCase.execute({ segment: '192.168.1.0/24' });

      expect(await prisma.discoveredDevice.count()).toBe(0);
    });

    it('[DEV-204] an ignored suggestion stays ignored and sends no notice', async () => {
      const ignoredAt = new Date('2026-10-01T00:00:00Z');
      await seedDiscoveredDevice(prisma, {
        macAddress: 'AA:BB:CC:DD:EE:20',
        ignoredAt
      });
      scanner.setHosts([host]);

      const result = await useCase.execute({
        segment: '192.168.1.0/24'
      });

      const row = await prisma.discoveredDevice.findFirstOrThrow();
      expect(row.ignoredAt).toEqual(ignoredAt);
      expect(result.value.discoveredHosts[0].isNew).toBe(false);
      expect(notifier.notices).toHaveLength(0);
    });

    it('[DEV-206] one notice names the segment and counts the new hosts', async () => {
      scanner.setHosts([
        host,
        {
          ...host,
          ipAddress: '192.168.1.30',
          macAddress: 'AA:BB:CC:DD:EE:30'
        }
      ]);

      await useCase.execute({ segment: '192.168.1.0/24' });

      expect(notifier.notices).toEqual([
        {
          count: 2,
          where: '192.168.1.0/24',
          occurredAt: expect.any(Date)
        }
      ]);
    });

    it('[DEV-207] a MAC answering for several addresses is not stored', async () => {
      scanner.setHosts([
        { ...host, ipAddress: '192.168.1.40' },
        { ...host, ipAddress: '192.168.1.41' }
      ]);

      const result = await useCase.execute({
        segment: '192.168.1.0/24'
      });

      expect(await prisma.discoveredDevice.count()).toBe(0);
      expect(result.value.newCount).toBe(0);
    });
  });

  describe('[DEV-214] from an agent', () => {
    it('scans from the agent, even off site, and records what it found', async () => {
      const agent = await seedAgent(prisma, { status: 'ACTIVE' });
      agents.setHosts([
        {
          ipAddress: '10.0.0.7',
          macAddress: 'AA:BB:CC:DD:EE:07',
          latencyMs: 5
        }
      ]);

      const result = await makeUseCase(false).execute({
        segment: '10.0.0.0/24',
        agentId: agent.id
      });

      expect(agents.calls).toEqual([
        { agentId: agent.id, cidr: '10.0.0.0/24' }
      ]);
      expect(scanner.callCount).toBe(0);
      expect(result.value).toMatchObject({
        agentId: agent.id,
        responsiveCount: 1,
        newCount: 1
      });
      expect(await prisma.discoveredDevice.count()).toBe(1);
    });

    it('a pending agent may scan before its installer runs', async () => {
      const agent = await seedAgent(prisma);

      const result = await useCase.execute({
        segment: '10.0.0.0/24',
        agentId: agent.id
      });

      expect(result.isSuccess).toBe(true);
    });

    it('fails for a revoked agent without asking it', async () => {
      const agent = await seedAgent(prisma, { status: 'REVOKED' });

      const result = await useCase.execute({
        segment: '10.0.0.0/24',
        agentId: agent.id
      });

      expect(result.error).toBe(SCAN_AGENT_NOT_FOUND);
      expect(agents.calls).toEqual([]);
    });

    it('fails for an agent that does not exist', async () => {
      const result = await useCase.execute({
        segment: '10.0.0.0/24',
        agentId: '0b9c6f0e-3f4a-4c55-9a51-6f7d2a1c8e10'
      });

      expect(result.error).toBe(SCAN_AGENT_NOT_FOUND);
    });

    it('fails for a malformed agent id', async () => {
      const result = await useCase.execute({
        segment: '10.0.0.0/24',
        agentId: 'not-an-id'
      });

      expect(result.error).toBe('agentId must be an agent id');
    });

    it('fails with why the agent could not scan, recording nothing', async () => {
      const agent = await seedAgent(prisma, { status: 'ACTIVE' });
      agents.failWith('The agent did not answer in time');

      const result = await useCase.execute({
        segment: '10.0.0.0/24',
        agentId: agent.id
      });

      expect(result.error).toBe(
        'The agent could not scan: The agent did not answer in time'
      );
      expect(await prisma.discoveredDevice.count()).toBe(0);
    });

    it('off site without an agent it still refuses', async () => {
      const result = await makeUseCase(false).execute({
        segment: '10.0.0.0/24'
      });

      expect(result.error).toBe(SCAN_NEEDS_SERVER_ON_SITE);
      expect(scanner.callCount).toBe(0);
    });
  });
});
