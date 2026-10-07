// Source: src/application/device-backups/use-cases/BackUpDeviceNowUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import {
  AGENT_BACKUP_FAILURES,
  BACKUP_REFUSALS
} from 'application/device-backups';
import { CredentialsEncryption } from 'infrastructure/crypto';
import {
  cleanDatabase,
  seedAgent,
  seedWirelessDeviceModel,
  GHOST_ID,
  INVALID_ID
} from '../../helpers/db';
import { seedDiagnosableDevice } from '../../helpers/linkDiagnosis';
import { FakeAgentConfigFetcher } from '../../helpers/FakeAgentConfigFetcher';
import {
  FakeConfigFetcher,
  FAKE_AIROS_CONFIG
} from '../../helpers/FakeConfigFetcher';
import {
  buildDeviceBackups,
  FAKE_ROUTEROS_EXPORT,
  seedRouter
} from '../../helpers/deviceBackups';
import { BackupFormat } from 'domain/device-backups';

// Covers a backup taken on request against the real tables: the file is
// stored encrypted, a repeat keeps one version, and every attempt — refused,
// failed or saved — lands in the device's backup state.
describe('BackUpDeviceNowUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let modelId: string;
  let now: Date;
  const fetcher = new FakeConfigFetcher();

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    fetcher.reset();
    now = new Date('2026-10-07T08:00:00Z');
    await cleanDatabase(prisma);
    modelId = await seedWirelessDeviceModel(prisma);
  });

  const build = (serverOnSite = true) =>
    buildDeviceBackups(prisma, fetcher, {
      serverOnSite,
      clock: () => now
    }).backUpNow;

  const seedAp = (opts: { withCredentials?: boolean } = {}) =>
    seedDiagnosableDevice(prisma, modelId, {
      ip: '10.0.0.10',
      deviceType: 'ACCESS_POINT',
      ...opts
    });

  it('[BKP-001] [BKP-040] should save the file encrypted', async () => {
    const deviceId = await seedAp();

    const result = await build().execute({ deviceId });

    expect(result.value.outcome).toBe('SAVED');
    expect(result.value.backup).toMatchObject({
      deviceId,
      format: 'AIROS_CFG',
      trigger: 'MANUAL',
      sizeBytes: Buffer.byteLength(FAKE_AIROS_CONFIG)
    });
    const row = await prisma.configBackup.findFirstOrThrow({
      where: { deviceId }
    });
    expect(row.encryptedContent).not.toContain('radio.1.mode');
    expect(CredentialsEncryption.decrypt(row.encryptedContent)).toBe(
      FAKE_AIROS_CONFIG
    );
    expect(fetcher.calls).toEqual([
      { ipAddress: '10.0.0.10', username: 'ubnt', sshPort: 22 }
    ]);
  });

  it('[BKP-006] should keep one version when the device still holds it', async () => {
    const deviceId = await seedAp();
    await build().execute({ deviceId });
    now = new Date('2026-10-08T08:00:00Z');

    const result = await build().execute({ deviceId });

    expect(result.value.outcome).toBe('UNCHANGED');
    const rows = await prisma.configBackup.findMany({
      where: { deviceId }
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].lastCheckedAt).toEqual(now);
    expect(rows[0].takenAt).toEqual(new Date('2026-10-07T08:00:00Z'));
  });

  it('[BKP-020] should record a device failure in the backup state', async () => {
    const deviceId = await seedAp();
    fetcher.fail('HTTPS_TIMEOUT (10.0.0.10:443)');

    const result = await build().execute({ deviceId });

    expect(result.error).toBe(
      'Backup failed: HTTPS_TIMEOUT (10.0.0.10:443)'
    );
    const state = await prisma.deviceBackupState.findUniqueOrThrow({
      where: { deviceId }
    });
    expect(state).toMatchObject({
      lastOutcome: 'FAILED',
      lastError: 'HTTPS_TIMEOUT (10.0.0.10:443)',
      consecutiveFailures: 1,
      failingSince: now
    });
  });

  it('[BKP-014] should refuse an access point with no credentials', async () => {
    const deviceId = await seedAp({ withCredentials: false });

    const result = await build().execute({ deviceId });

    expect(result.error).toBe(
      `Cannot back up this device: ${BACKUP_REFUSALS.NO_CREDENTIALS}`
    );
    expect(fetcher.calls).toHaveLength(0);
  });

  it('[BKP-014] should refuse a station', async () => {
    const deviceId = await seedDiagnosableDevice(prisma, modelId, {
      ip: '10.0.0.20',
      deviceType: 'STATION'
    });

    const result = await build().execute({ deviceId });

    expect(result.error).toBe(
      `Cannot back up this device: ${BACKUP_REFUSALS.NOT_MAIN_DEVICE}`
    );
  });

  it('[BKP-014] should refuse a router of a vendor with no RouterOS', async () => {
    const routerId = await seedRouter(prisma, {
      ip: '10.0.0.1',
      vendorSlug: 'ubiquiti',
      deviceType: 'ROUTER'
    });

    const result = await build().execute({ deviceId: routerId });

    expect(result.error).toBe(
      `Cannot back up this device: ${BACKUP_REFUSALS.UNSUPPORTED_VENDOR}`
    );
    expect(fetcher.calls).toHaveLength(0);
  });

  it('[BKP-054] [BKP-055] should back up a MikroTik router with its login and SSH port', async () => {
    const routerId = await seedRouter(prisma, {
      ip: '10.0.0.1',
      sshPort: 2222
    });
    fetcher.serve(FAKE_ROUTEROS_EXPORT, BackupFormat.ROUTEROS_EXPORT);

    const result = await build().execute({ deviceId: routerId });

    expect(result.value.outcome).toBe('SAVED');
    expect(result.value.backup.format).toBe('ROUTEROS_EXPORT');
    expect(fetcher.calls).toEqual([
      { ipAddress: '10.0.0.1', username: 'admin', sshPort: 2222 }
    ]);
  });

  it('[BKP-055] should use SSH port 22 when none was set', async () => {
    const routerId = await seedRouter(prisma, { ip: '10.0.0.1' });
    fetcher.serve(FAKE_ROUTEROS_EXPORT, BackupFormat.ROUTEROS_EXPORT);

    await build().execute({ deviceId: routerId });

    expect(fetcher.calls[0].sshPort).toBe(22);
  });

  describe('[BKP-016] off site, through the agent', () => {
    let agent: FakeAgentConfigFetcher;

    const behindAgent = async () => {
      const deviceId = await seedAp();
      const { id: agentId } = await seedAgent(prisma, {
        name: 'Torre Norte'
      });
      await prisma.device.update({
        where: { id: deviceId },
        data: { agentId }
      });
      return { deviceId, agentId };
    };

    const offSite = () =>
      buildDeviceBackups(prisma, fetcher, {
        serverOnSite: false,
        clock: () => now,
        agent
      }).backUpNow;

    beforeEach(() => {
      agent = new FakeAgentConfigFetcher();
    });

    it('should save what the device agent read', async () => {
      const { deviceId, agentId } = await behindAgent();

      const result = await offSite().execute({ deviceId });

      expect(result.value.outcome).toBe('SAVED');
      expect(agent.calls).toEqual([
        { agentId, ipAddress: '10.0.0.10' }
      ]);
      expect(fetcher.calls).toHaveLength(0);
    });

    it('should refuse when the agent must be updated first', async () => {
      const { deviceId } = await behindAgent();
      agent.answer = {
        kind: 'refused',
        reason: 'PROBE_UNSUPPORTED',
        error: 'The agent must be updated to take backups'
      };

      const result = await offSite().execute({ deviceId });

      expect(result.error).toBe(
        `Cannot back up this device: ${AGENT_BACKUP_FAILURES.PROBE_UNSUPPORTED}`
      );
    });

    it('should fail when the agent is not connected', async () => {
      const { deviceId } = await behindAgent();
      agent.answer = {
        kind: 'refused',
        reason: 'AGENT_OFFLINE',
        error: 'The agent is not connected'
      };

      const result = await offSite().execute({ deviceId });

      expect(result.error).toBe(
        `Backup failed: ${AGENT_BACKUP_FAILURES.AGENT_OFFLINE}`
      );
    });
  });

  it('[BKP-010] should back up a device categorised as an access point that is not polled', async () => {
    const deviceId = await seedDiagnosableDevice(prisma, modelId, {
      ip: '10.0.0.10',
      deviceType: 'ACCESS_POINT',
      withConfig: false
    });

    const result = await build().execute({ deviceId });

    expect(result.value.outcome).toBe('SAVED');
  });

  it('[BKP-015] should refuse a device behind no agent when this server is off site', async () => {
    const deviceId = await seedAp();

    const result = await build(false).execute({ deviceId });

    expect(result.error).toBe(
      `Cannot back up this device: ${BACKUP_REFUSALS.OUT_OF_REACH}`
    );
  });

  it('should fail for a deleted device', async () => {
    const deviceId = await seedAp();
    await prisma.device.update({
      where: { id: deviceId },
      data: { deletedAt: new Date() }
    });

    const result = await build().execute({ deviceId });

    expect(result.error).toBe('Device not found');
  });

  it('should fail for an unknown device', async () => {
    const result = await build().execute({ deviceId: GHOST_ID });

    expect(result.error).toBe('Device not found');
  });

  it('should fail for a malformed id', async () => {
    const result = await build().execute({ deviceId: INVALID_ID });

    expect(result.error).toMatch(/^Invalid device ID/);
  });
});
