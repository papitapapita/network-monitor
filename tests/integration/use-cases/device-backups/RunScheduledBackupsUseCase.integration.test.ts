// Source: src/application/device-backups/use-cases/RunScheduledBackupsUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import {
  BACKUP_FRESH_FOR_MS,
  BACKUP_REFUSALS,
  BACKUP_VERSIONS_KEPT
} from 'application/device-backups';
import {
  cleanDatabase,
  seedAgent,
  seedWirelessDeviceModel
} from '../../helpers/db';
import { seedDiagnosableDevice } from '../../helpers/linkDiagnosis';
import { FakeConfigFetcher } from '../../helpers/FakeConfigFetcher';
import { FakeAgentConfigFetcher } from '../../helpers/FakeAgentConfigFetcher';
import {
  buildDeviceBackups,
  seedRouter
} from '../../helpers/deviceBackups';
import { EventDispatcher } from 'domain/shared/core';
import { IDomainEvent } from 'domain/shared/interfaces';
import { BACKUP_FAILURES_BEFORE_ALERT } from 'domain/device-backups';
import { DeviceBackupFailingEvent } from 'domain/device-backups/events';

const DAY = 24 * 60 * 60 * 1000;

// The nightly run has no HTTP surface, so this suite is its only coverage
// against real rows: which devices the run picks (BKP-010), what it skips
// (BKP-012), that retention holds in the table (BKP-030), and which alerts a
// run raises once its rows are saved (BKP-061, BKP-063).
describe('RunScheduledBackupsUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let modelId: string;
  const now = new Date('2026-10-07T08:00:00Z');
  const fetcher = new FakeConfigFetcher();

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();
    // The real handlers publish alerts; only the 'alerts' tests listen.
    EventDispatcher.clearHandlers();
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    fetcher.reset();
    await cleanDatabase(prisma);
    modelId = await seedWirelessDeviceModel(prisma);
  });

  const run = (at: Date = now, serverOnSite = true) =>
    buildDeviceBackups(prisma, fetcher, {
      serverOnSite
    }).runScheduled.execute({ now: at });

  const seedAp = (
    ip: string,
    opts: { withCredentials?: boolean } = {}
  ) =>
    seedDiagnosableDevice(prisma, modelId, {
      ip,
      deviceType: 'ACCESS_POINT',
      ...opts
    });

  const backedUpIps = () =>
    fetcher.calls.map((c) => c.ipAddress).sort();

  describe('[BKP-010] which devices', () => {
    it('should back up the polled access points in service', async () => {
      await seedAp('10.0.0.10');
      await seedAp('10.0.0.11');

      const result = await run();

      expect(result.value.saved).toBe(2);
      expect(backedUpIps()).toEqual(['10.0.0.10', '10.0.0.11']);
    });

    it('should back up the polled stations in service', async () => {
      await seedDiagnosableDevice(prisma, modelId, {
        ip: '10.0.0.20',
        deviceType: 'STATION'
      });

      const result = await run();

      expect(result.value.saved).toBe(1);
      expect(backedUpIps()).toEqual(['10.0.0.20']);
    });

    it('should back up a device categorised as a wireless CPE that wireless monitoring does not poll', async () => {
      await seedDiagnosableDevice(prisma, modelId, {
        ip: '10.0.0.20',
        deviceType: 'STATION',
        withConfig: false
      });

      const result = await run();

      expect(result.value.saved).toBe(1);
    });

    it.each(['CLIENT', null] as const)(
      'should leave out antennas and routerboards whose owner is %s',
      async (owner) => {
        const ap = await seedAp('10.0.0.10');
        const station = await seedDiagnosableDevice(prisma, modelId, {
          ip: '10.0.0.20',
          deviceType: 'STATION'
        });
        await prisma.device.updateMany({
          where: { id: { in: [ap, station] } },
          data: { owner }
        });
        await seedRouter(prisma, { ip: '10.0.0.2', owner });

        const result = await run();

        expect(result.value.saved).toBe(0);
        expect(fetcher.calls).toHaveLength(0);
      }
    );

    it('should leave out an access point whose polling is disabled', async () => {
      const deviceId = await seedAp('10.0.0.10');
      await prisma.wirelessPollingConfiguration.update({
        where: { deviceId },
        data: { enabled: false }
      });

      await run();

      expect(fetcher.calls).toHaveLength(0);
    });

    it.each(['INVENTORY', 'DECOMMISSIONED'] as const)(
      'should leave out an access point in %s',
      async (status) => {
        const deviceId = await seedAp('10.0.0.10');
        await prisma.device.update({
          where: { id: deviceId },
          data: { status }
        });

        await run();

        expect(fetcher.calls).toHaveLength(0);
      }
    );

    it('should back up a device categorised as an access point that wireless monitoring does not poll', async () => {
      await seedDiagnosableDevice(prisma, modelId, {
        ip: '10.0.0.10',
        deviceType: 'ACCESS_POINT',
        withConfig: false
      });

      const result = await run();

      expect(result.value.saved).toBe(1);
      expect(backedUpIps()).toEqual(['10.0.0.10']);
    });

    it('should leave out a station whose polling is disabled', async () => {
      const deviceId = await seedDiagnosableDevice(prisma, modelId, {
        ip: '10.0.0.20',
        deviceType: 'STATION'
      });
      await prisma.wirelessPollingConfiguration.update({
        where: { deviceId },
        data: { enabled: false }
      });

      await run();

      expect(fetcher.calls).toHaveLength(0);
    });

    it('should include an access point being commissioned', async () => {
      const deviceId = await seedAp('10.0.0.10');
      await prisma.device.update({
        where: { id: deviceId },
        data: { status: 'COMMISSIONING' }
      });

      await run();

      expect(backedUpIps()).toEqual(['10.0.0.10']);
    });

    it('should leave out a deleted access point', async () => {
      const deviceId = await seedAp('10.0.0.10');
      await prisma.device.update({
        where: { id: deviceId },
        data: { deletedAt: new Date() }
      });

      await run();

      expect(fetcher.calls).toHaveLength(0);
    });

    it('should back up the routerboards and switches in service', async () => {
      await seedRouter(prisma, {
        ip: '10.0.0.2',
        deviceType: 'ROUTERBOARD'
      });
      await seedRouter(prisma, {
        ip: '10.0.0.3',
        deviceType: 'SWITCH'
      });

      const result = await run();

      expect(result.value.saved).toBe(2);
      expect(backedUpIps()).toEqual(['10.0.0.2', '10.0.0.3']);
    });

    it('should leave out a plain router, such as a Wi-Fi router', async () => {
      await seedRouter(prisma, {
        ip: '10.0.0.1',
        vendorSlug: 'tenda',
        deviceType: 'ROUTER'
      });

      const result = await run();

      expect(result.value).toEqual({
        saved: 0,
        unchanged: 0,
        skipped: 0,
        failed: []
      });
    });

    it('should leave out a router in inventory and a server', async () => {
      await seedRouter(prisma, {
        ip: '10.0.0.1',
        status: 'INVENTORY'
      });
      await seedRouter(prisma, {
        ip: '10.0.0.4',
        deviceType: 'SERVER'
      });

      await run();

      expect(fetcher.calls).toHaveLength(0);
    });

    it('[BKP-014] should record a switch of a vendor with no RouterOS as failing', async () => {
      const deviceId = await seedRouter(prisma, {
        ip: '10.0.0.3',
        vendorSlug: 'ubiquiti',
        deviceType: 'SWITCH'
      });

      const result = await run();

      expect(fetcher.calls).toHaveLength(0);
      expect(result.value.failed).toEqual([
        expect.objectContaining({
          deviceId,
          error: BACKUP_REFUSALS.UNSUPPORTED_VENDOR
        })
      ]);
    });

    it('[BKP-015] should back up only the devices behind an agent when this server is off site', async () => {
      const agent = new FakeAgentConfigFetcher();
      const { id: agentId } = await seedAgent(prisma, {
        name: 'Torre Norte'
      });
      const behindAgent = await seedAp('10.0.0.10');
      await prisma.device.update({
        where: { id: behindAgent },
        data: { agentId }
      });
      await seedAp('10.0.0.11');

      const result = await buildDeviceBackups(prisma, fetcher, {
        serverOnSite: false,
        agent
      }).runScheduled.execute({ now });

      expect(result.value).toEqual({
        saved: 1,
        unchanged: 0,
        skipped: 0,
        failed: []
      });
      expect(agent.calls).toEqual([
        { agentId, ipAddress: '10.0.0.10' }
      ]);
      expect(fetcher.calls).toHaveLength(0);
    });

    it('[BKP-015] should still back up every device itself when on site, behind an agent or not', async () => {
      const agent = new FakeAgentConfigFetcher();
      const { id: agentId } = await seedAgent(prisma, {
        name: 'Torre Norte'
      });
      const behindAgent = await seedAp('10.0.0.10');
      await prisma.device.update({
        where: { id: behindAgent },
        data: { agentId }
      });

      const result = await buildDeviceBackups(prisma, fetcher, {
        agent
      }).runScheduled.execute({ now });

      expect(result.value.saved).toBe(1);
      expect(backedUpIps()).toEqual(['10.0.0.10']);
      expect(agent.calls).toHaveLength(0);
    });
  });

  describe('[BKP-014] an access point that cannot be backed up', () => {
    it('should be reported and recorded, and the others still run', async () => {
      const noLogin = await seedAp('10.0.0.10', {
        withCredentials: false
      });
      await seedAp('10.0.0.11');

      const result = await run();

      expect(result.value.saved).toBe(1);
      expect(result.value.failed).toEqual([
        {
          deviceId: noLogin,
          deviceName: 'Radio 10.0.0.10',
          error: BACKUP_REFUSALS.NO_CREDENTIALS
        }
      ]);
      const state = await prisma.deviceBackupState.findUniqueOrThrow({
        where: { deviceId: noLogin }
      });
      expect(state.lastError).toBe(BACKUP_REFUSALS.NO_CREDENTIALS);
    });
  });

  describe('[BKP-012] repeated runs', () => {
    it('should skip a device backed up within the window', async () => {
      await seedAp('10.0.0.10');
      await run();
      fetcher.reset();

      const result = await run(
        new Date(now.getTime() + BACKUP_FRESH_FOR_MS - 60_000)
      );

      expect(result.value.skipped).toBe(1);
      expect(fetcher.calls).toHaveLength(0);
    });

    it('should check the device again the next night', async () => {
      const deviceId = await seedAp('10.0.0.10');
      await run();
      const nextNight = new Date(now.getTime() + DAY);

      const result = await run(nextNight);

      expect(result.value.unchanged).toBe(1);
      const row = await prisma.configBackup.findFirstOrThrow({
        where: { deviceId }
      });
      expect(row.lastCheckedAt).toEqual(nextNight);
    });

    it('should retry a device that failed, even within the window', async () => {
      await seedAp('10.0.0.10');
      fetcher.fail('HTTPS_TIMEOUT (10.0.0.10:443)');
      await run();
      fetcher.reset();

      const result = await run(new Date(now.getTime() + 60 * 60_000));

      expect(result.value.saved).toBe(1);
    });
  });

  describe('[BKP-030] retention', () => {
    it('should keep only the latest configuration in the table', async () => {
      const deviceId = await seedAp('10.0.0.10');
      for (let day = 0; day < 3; day++) {
        fetcher.serve(`system.revision=${day}\n`);
        await run(new Date(now.getTime() + day * DAY));
      }

      const rows = await prisma.configBackup.findMany({
        where: { deviceId }
      });
      expect(BACKUP_VERSIONS_KEPT).toBe(1);
      expect(rows).toHaveLength(1);
      expect(rows[0].takenAt).toEqual(
        new Date(now.getTime() + 2 * DAY)
      );
    });
  });

  describe('alerts', () => {
    let captured: IDomainEvent[];

    // A recorder of the backup events dispatched after each save.
    beforeEach(() => {
      captured = [];
      EventDispatcher.clearHandlers();
      EventDispatcher.register(DeviceBackupFailingEvent.name, {
        handle: async (event: IDomainEvent) => {
          captured.push(event);
        }
      });
    });

    afterAll(() => EventDispatcher.clearHandlers());

    it('[BKP-030] should replace the copy quietly when the configuration changed', async () => {
      await seedAp('10.0.0.10');
      await run();
      fetcher.serve('aaa.1.status=disabled\n');

      const result = await run(new Date(now.getTime() + DAY));

      expect(result.value.saved).toBe(1);
      expect(captured).toHaveLength(0);
    });

    it('[BKP-063] should not announce an access point of a vendor with no backup support', async () => {
      const mimosa = await prisma.vendor.upsert({
        where: { slug: 'mimosa' },
        create: { name: 'Mimosa', slug: 'mimosa' },
        update: {}
      });
      const mimosaModel = await prisma.deviceModel.upsert({
        where: {
          vendorId_model: { vendorId: mimosa.id, model: 'C5x' }
        },
        create: {
          vendorId: mimosa.id,
          model: 'C5x',
          deviceType: 'ANTENNA',
          isWireless: true
        },
        update: {}
      });
      const deviceId = await seedDiagnosableDevice(
        prisma,
        mimosaModel.id,
        { ip: '10.0.0.10', deviceType: 'ACCESS_POINT' }
      );

      for (
        let night = 0;
        night < BACKUP_FAILURES_BEFORE_ALERT;
        night++
      )
        await run(new Date(now.getTime() + night * DAY));

      expect(captured).toHaveLength(0);
      const state = await prisma.deviceBackupState.findUniqueOrThrow({
        where: { deviceId }
      });
      expect(state.consecutiveFailures).toBe(
        BACKUP_FAILURES_BEFORE_ALERT
      );
      expect(state.lastError).toBe(
        BACKUP_REFUSALS.UNSUPPORTED_VENDOR
      );
    });

    it(`[BKP-061] should announce a device failing ${BACKUP_FAILURES_BEFORE_ALERT} nights in a row, once`, async () => {
      const deviceId = await seedAp('10.0.0.10');
      fetcher.fail('Login rejected');

      for (
        let night = 0;
        night < BACKUP_FAILURES_BEFORE_ALERT + 2;
        night++
      )
        await run(new Date(now.getTime() + night * DAY));

      expect(captured).toHaveLength(1);
      const event = captured[0] as DeviceBackupFailingEvent;
      expect(event).toBeInstanceOf(DeviceBackupFailingEvent);
      expect(event.aggregateId.toString()).toBe(deviceId);
      expect(event.failingSince).toEqual(now);
      expect(event.lastError).toBe('Login rejected');
    });
  });
});
