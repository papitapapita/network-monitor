import { PrismaClient } from '../../../../src/generated/prisma/client';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import { SseBroadcaster } from 'infrastructure/realtime/SseBroadcaster';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import {
  cleanDatabase,
  cleanBills,
  cleanTickets,
  cleanQuotations,
  cleanCustomers,
  seedCustomer,
  seedServicePlan,
  seedActiveContractedService,
  seedWirelessDeviceModel,
  GHOST_ID,
  INVALID_ID
} from '../../helpers/db';
import { FakePingService } from '../../helpers/FakePingService';
import { FakeWirelessCollector } from '../../helpers/FakeWirelessCollector';
import {
  buildLinkDiagnosis,
  seedDiagnosableDevice,
  LinkDiagnosisStack
} from '../../helpers/linkDiagnosis';

// Start is where the database is read: eligibility, config, encrypted
// credentials, vendor, the parent AP and the contracted plan all resolve
// here before any probe is sent. The probes themselves go to fakes.
describe('StartLinkDiagnosisUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let stack: LinkDiagnosisStack;
  let deviceModelId: string;
  const ping = new FakePingService();
  const collector = new FakeWirelessCollector();

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();
    stack = buildLinkDiagnosis(
      prisma,
      new SseBroadcaster(new WinstonLogger()),
      { ping, collector }
    );
  });

  afterAll(async () => {
    stack.runner.stopAll();
    await container.disconnect();
  });

  beforeEach(async () => {
    collector.reset();
    await cleanQuotations(prisma);
    await cleanBills(prisma);
    await cleanTickets(prisma);
    await cleanCustomers(prisma);
    await cleanDatabase(prisma);
    deviceModelId = await seedWirelessDeviceModel(prisma);
  });

  afterEach(() => {
    stack.runner.stopAll();
  });

  const seed = (
    ip: string,
    opts: Omit<Parameters<typeof seedDiagnosableDevice>[2], 'ip'> = {}
  ) => seedDiagnosableDevice(prisma, deviceModelId, { ip, ...opts });

  describe('[WLS-180] happy path', () => {
    it('starts a session and reads the radio at its configured IP with decrypted credentials', async () => {
      const deviceId = await seed('192.168.80.10');

      const result = await stack.start.execute({
        deviceId,
        durationSeconds: 30
      });

      expect(result.isSuccess).toBe(true);
      expect(result.value.started).toBe(true);
      expect(result.value.diagnosis).toMatchObject({
        deviceId,
        status: 'RUNNING',
        durationSeconds: 30,
        target: { ipAddress: '192.168.80.10' }
      });
      // the opening radio read fires immediately
      expect(collector.calls).toEqual(['192.168.80.10']);
    });

    it('joins a running session on a second start', async () => {
      const deviceId = await seed('192.168.80.11');
      await stack.start.execute({ deviceId });

      const second = await stack.start.execute({ deviceId });

      expect(second.value.started).toBe(false);
      expect(collector.calls).toHaveLength(1);
    });
  });

  describe('[WLS-184] parent hop', () => {
    it('pings the declared parent AP at the IP of its own wireless config', async () => {
      const apId = await seed('192.168.80.1', {
        deviceType: 'ACCESS_POINT'
      });
      const deviceId = await seed('192.168.80.12', {
        parentApDeviceId: apId
      });

      const result = await stack.start.execute({ deviceId });

      expect(result.value.diagnosis.parent).toEqual({
        deviceId: apId,
        ipAddress: '192.168.80.1',
        name: null
      });
    });

    it('falls back to the AP the latest snapshot reported', async () => {
      const deviceId = await seed('192.168.80.13');
      await prisma.wirelessSnapshot.create({
        data: {
          deviceId,
          deviceType: 'STATION',
          collectedAt: new Date(),
          collectionMethod: 'http_api',
          remoteApIp: '192.168.80.2'
        }
      });

      const result = await stack.start.execute({ deviceId });

      expect(result.value.diagnosis.parent).toMatchObject({
        deviceId: null,
        ipAddress: '192.168.80.2'
      });
    });

    it('gives an access point no parent hop', async () => {
      const deviceId = await seed('192.168.80.14', {
        deviceType: 'ACCESS_POINT'
      });

      const result = await stack.start.execute({ deviceId });

      expect(result.value.diagnosis.parent).toBeNull();
    });
  });

  it('[WLS-166] measures against the contracted plan', async () => {
    const deviceId = await seed('192.168.80.15');
    const customerId = await seedCustomer(prisma);
    const planId = await seedServicePlan(prisma, {
      name: 'Plan 15/5',
      downloadMbps: 15,
      uploadMbps: 5
    });
    await seedActiveContractedService(prisma, customerId, planId, {
      deviceId
    });

    const result = await stack.start.execute({ deviceId });

    expect(
      result.value.diagnosis.report.radio.throughput.linkCapacityKbps
    ).toBe(20_000);
  });

  it('[WLS-190] writes no snapshot, alert record or poll timestamp', async () => {
    const deviceId = await seed('192.168.80.20');
    // weak enough to trip the signal rule on every read
    collector.setResult({ signalRxDbm: -85 });

    await stack.start.execute({ deviceId });
    await new Promise((resolve) => setTimeout(resolve, 50));
    const stopped = await stack.stop.execute({ deviceId });

    expect(stopped.value.report.findings).toEqual([
      expect.objectContaining({
        code: 'signal_rx_dbm',
        severity: 'CRITICAL'
      })
    ]);
    expect(
      await prisma.wirelessSnapshot.count({ where: { deviceId } })
    ).toBe(0);
    expect(
      await prisma.wirelessAlertRecord.count({ where: { deviceId } })
    ).toBe(0);
    const config =
      await prisma.wirelessPollingConfiguration.findUnique({
        where: { deviceId }
      });
    expect(config?.lastPolledAt).toBeNull();
  });

  describe('refusals', () => {
    it('fails as not found for an unknown device', async () => {
      const result = await stack.start.execute({
        deviceId: GHOST_ID
      });

      expect(result.error).toBe(
        'Cannot diagnose device — the device no longer exists'
      );
    });

    it('fails for a soft-deleted device', async () => {
      const deviceId = await seed('192.168.80.16');
      await prisma.device.update({
        where: { id: deviceId },
        data: { deletedAt: new Date() }
      });

      const result = await stack.start.execute({ deviceId });

      expect(result.error).toBe(
        'Cannot diagnose device — the device no longer exists'
      );
    });

    it('refuses a device with monitoring disabled', async () => {
      const deviceId = await seed('192.168.80.17', {
        monitoringEnabled: false
      });

      const result = await stack.start.execute({ deviceId });

      expect(result.error).toBe(
        'Cannot diagnose device — Device has monitoring disabled'
      );
    });

    it('fails without a wireless config', async () => {
      const deviceId = await seed('192.168.80.18', {
        withConfig: false
      });

      const result = await stack.start.execute({ deviceId });

      expect(result.error).toBe(
        'No wireless polling configuration found for device'
      );
    });

    it('fails without credentials', async () => {
      const deviceId = await seed('192.168.80.19', {
        withCredentials: false
      });

      const result = await stack.start.execute({ deviceId });

      expect(result.error).toBe(
        'Credentials not configured for device'
      );
      expect(collector.calls).toHaveLength(0);
    });

    it('rejects a malformed id', async () => {
      const result = await stack.start.execute({
        deviceId: INVALID_ID
      });

      expect(result.error).toMatch(/^Invalid device ID/);
    });
  });
});
