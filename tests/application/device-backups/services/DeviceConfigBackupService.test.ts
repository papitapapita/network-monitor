// Source: src/application/device-backups/services/DeviceConfigBackupService.ts

import {
  AGENT_BACKUP_FAILURES,
  BACKUP_REFUSALS,
  BACKUP_VERSIONS_KEPT,
  DeviceConfigBackupService
} from '../../../../src/application/device-backups/services';
import {
  AgentConfigAnswer,
  IAgentConfigFetcher
} from '../../../../src/application/device-backups/interfaces';
import {
  BackupFormat,
  BackupOutcome,
  BackupTrigger
} from '../../../../src/domain/device-backups';
import { DeviceBackupFailingEvent } from '../../../../src/domain/device-backups/events';
import { DeviceId } from '../../../../src/domain/shared/ids';
import {
  AIROS_CONFIG,
  FakeFetcher,
  InMemoryConfigBackupRepository,
  InMemoryDeviceBackupStateRepository,
  makeCandidate
} from '../inMemoryBackups';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-10-07T08:00:00Z');

describe('DeviceConfigBackupService', () => {
  let fetcher: FakeFetcher;
  let backups: InMemoryConfigBackupRepository;
  let states: InMemoryDeviceBackupStateRepository;
  let service: DeviceConfigBackupService;

  beforeEach(() => {
    fetcher = new FakeFetcher();
    backups = new InMemoryConfigBackupRepository();
    states = new InMemoryDeviceBackupStateRepository();
    service = new DeviceConfigBackupService(fetcher, backups, states);
  });

  const stateOf = (deviceId: string) =>
    states.states.get(DeviceId.parse(deviceId).value.toString());

  describe('a first backup', () => {
    it('[BKP-001] should save the file the device sent', async () => {
      const candidate = makeCandidate();

      const result = await service.backUp(
        candidate,
        BackupTrigger.SCHEDULED,
        NOW
      );

      expect(result.value.outcome).toBe(BackupOutcome.SAVED);
      expect(backups.rows).toHaveLength(1);
      expect(backups.rows[0].content).toBe(AIROS_CONFIG);
      expect(backups.rows[0].backup.trigger).toBe(
        BackupTrigger.SCHEDULED
      );
      expect(backups.rows[0].backup.sizeBytes).toBe(
        Buffer.byteLength(AIROS_CONFIG)
      );
    });

    it('[BKP-020] should record the success', async () => {
      const candidate = makeCandidate();

      await service.backUp(candidate, BackupTrigger.MANUAL, NOW);

      expect(stateOf(candidate.deviceId)?.lastOutcome).toBe(
        BackupOutcome.SAVED
      );
      expect(stateOf(candidate.deviceId)?.lastSuccessAt).toEqual(NOW);
    });
  });

  describe('a later backup', () => {
    it('[BKP-006] should keep one version when nothing changed', async () => {
      const candidate = makeCandidate();
      await service.backUp(candidate, BackupTrigger.SCHEDULED, NOW);
      const later = new Date(NOW.getTime() + DAY);

      const result = await service.backUp(
        candidate,
        BackupTrigger.SCHEDULED,
        later
      );

      expect(result.value.outcome).toBe(BackupOutcome.UNCHANGED);
      expect(backups.rows).toHaveLength(1);
      expect(backups.rows[0].backup.lastCheckedAt).toEqual(later);
    });

    it('[BKP-005] should not count line endings as a change', async () => {
      const candidate = makeCandidate();
      await service.backUp(candidate, BackupTrigger.SCHEDULED, NOW);
      fetcher.serve(AIROS_CONFIG.replace(/\n/g, '\r\n'));

      const result = await service.backUp(
        candidate,
        BackupTrigger.SCHEDULED,
        new Date(NOW.getTime() + DAY)
      );

      expect(result.value.outcome).toBe(BackupOutcome.UNCHANGED);
    });

    it('[BKP-010] should back up a Ubiquiti station like an access point', async () => {
      const result = await service.backUp(
        makeCandidate({
          kind: 'STATION',
          deviceName: 'PtP Torre Sur'
        }),
        BackupTrigger.SCHEDULED,
        NOW
      );

      expect(result.value.outcome).toBe(BackupOutcome.SAVED);
    });

    it('[BKP-030] should replace the kept copy when the configuration changed', async () => {
      const candidate = makeCandidate();
      await service.backUp(candidate, BackupTrigger.SCHEDULED, NOW);
      fetcher.serve('aaa.status=disabled\n');

      const result = await service.backUp(
        candidate,
        BackupTrigger.SCHEDULED,
        new Date(NOW.getTime() + DAY)
      );

      expect(result.value.outcome).toBe(BackupOutcome.SAVED);
      expect(backups.rows).toHaveLength(1);
      expect(backups.rows[0].content).toBe('aaa.status=disabled\n');
      expect(backups.rows[0].backup.domainEvents).toHaveLength(0);
    });

    it('[BKP-056] should not count a new AirOS write time and checksum as a change', async () => {
      const file = (written: string, checksum: string) =>
        `### PART ###\n## ${written}\n${AIROS_CONFIG}#${checksum}\n`;
      const candidate = makeCandidate();
      fetcher.serve(file('1626992172', 'a'.repeat(32)));
      await service.backUp(candidate, BackupTrigger.SCHEDULED, NOW);
      fetcher.serve(file('1628054048', 'b'.repeat(32)));

      const result = await service.backUp(
        candidate,
        BackupTrigger.SCHEDULED,
        new Date(NOW.getTime() + DAY)
      );

      expect(result.value.outcome).toBe(BackupOutcome.UNCHANGED);
    });

    it(`[BKP-030] should keep only the newest ${BACKUP_VERSIONS_KEPT} versions`, async () => {
      const candidate = makeCandidate();
      for (let day = 0; day < BACKUP_VERSIONS_KEPT + 2; day++) {
        fetcher.serve(`system.version=${day}\n`);
        await service.backUp(
          candidate,
          BackupTrigger.SCHEDULED,
          new Date(NOW.getTime() + day * DAY)
        );
      }

      expect(backups.rows).toHaveLength(BACKUP_VERSIONS_KEPT);
      const oldest = Math.min(
        ...backups.rows.map((r) => r.backup.takenAt.getTime())
      );
      expect(oldest).toBe(NOW.getTime() + 2 * DAY);
    });
  });

  describe('a device that cannot be read', () => {
    it('[BKP-061] should announce the streak with the device name', async () => {
      const candidate = makeCandidate();
      fetcher.fail('Login rejected');

      for (let day = 0; day < 3; day++)
        await service.backUp(
          candidate,
          BackupTrigger.SCHEDULED,
          new Date(NOW.getTime() + day * DAY)
        );

      const [event] = stateOf(candidate.deviceId)!
        .domainEvents as DeviceBackupFailingEvent[];
      expect(event).toBeInstanceOf(DeviceBackupFailingEvent);
      expect(event.deviceName).toBe('AP Torre Norte');
      expect(event.lastError).toBe('Login rejected');
    });

    it('[BKP-020] should record the device error as a failed attempt', async () => {
      const candidate = makeCandidate();
      fetcher.fail('HTTPS_TIMEOUT (10.0.0.10:443)');

      const result = await service.backUp(
        candidate,
        BackupTrigger.SCHEDULED,
        NOW
      );

      expect(result.isSuccess).toBe(true);
      expect(result.value).toEqual({
        outcome: BackupOutcome.FAILED,
        error: 'HTTPS_TIMEOUT (10.0.0.10:443)',
        refused: false
      });
      expect(stateOf(candidate.deviceId)?.lastError).toBe(
        'HTTPS_TIMEOUT (10.0.0.10:443)'
      );
      expect(backups.rows).toHaveLength(0);
    });

    it('[BKP-003] should fail an empty file rather than save it', async () => {
      const candidate = makeCandidate();
      fetcher.serve('');

      const result = await service.backUp(
        candidate,
        BackupTrigger.SCHEDULED,
        NOW
      );

      expect(result.value.outcome).toBe(BackupOutcome.FAILED);
      expect(backups.rows).toHaveLength(0);
    });

    it('should fail the Result when storage fails', async () => {
      backups.failWith = 'disk full';

      const result = await service.backUp(
        makeCandidate(),
        BackupTrigger.SCHEDULED,
        NOW
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('disk full');
    });
  });

  describe('a MikroTik router', () => {
    const exportAt = (date: string) =>
      `# ${date} by RouterOS 7.15\n# software id = AB12-CD34\n/ip address\nadd address=10.0.0.1/24 interface=ether1\n`;
    const router = makeCandidate({
      deviceName: 'Router Core',
      vendorSlug: 'mikrotik',
      kind: 'ROUTER'
    });

    it('[BKP-010] should back up a router as a RouterOS export', async () => {
      fetcher.serve(
        exportAt('2026-10-07 03:00:01'),
        BackupFormat.ROUTEROS_EXPORT
      );

      const result = await service.backUp(
        router,
        BackupTrigger.SCHEDULED,
        NOW
      );

      expect(result.value.outcome).toBe(BackupOutcome.SAVED);
      expect(backups.rows[0].backup.format).toBe(
        BackupFormat.ROUTEROS_EXPORT
      );
    });

    it('[BKP-052] should not count the export date as a change', async () => {
      fetcher.serve(
        exportAt('2026-10-07 03:00:01'),
        BackupFormat.ROUTEROS_EXPORT
      );
      await service.backUp(router, BackupTrigger.SCHEDULED, NOW);
      fetcher.serve(
        exportAt('2026-10-08 03:00:04'),
        BackupFormat.ROUTEROS_EXPORT
      );

      const result = await service.backUp(
        router,
        BackupTrigger.SCHEDULED,
        new Date(NOW.getTime() + DAY)
      );

      expect(result.value.outcome).toBe(BackupOutcome.UNCHANGED);
      expect(backups.rows).toHaveLength(1);
    });
  });

  describe('refusals (BKP-014)', () => {
    it.each([
      [
        'a device that is not a main device',
        { kind: null },
        BACKUP_REFUSALS.NOT_MAIN_DEVICE
      ],
      [
        'a device out of the server reach',
        { reach: { by: 'none' as const } },
        BACKUP_REFUSALS.OUT_OF_REACH
      ],
      [
        'a device with no IP address',
        { ipAddress: null },
        BACKUP_REFUSALS.NO_IP_ADDRESS
      ],
      [
        'a device with no credentials',
        { credentials: null },
        BACKUP_REFUSALS.NO_CREDENTIALS
      ],
      [
        'a vendor with no fetcher',
        { vendorSlug: 'mimosa' },
        BACKUP_REFUSALS.UNSUPPORTED_VENDOR
      ],
      [
        'a device model with no vendor',
        { vendorSlug: null },
        BACKUP_REFUSALS.UNSUPPORTED_VENDOR
      ],
      [
        'a Ubiquiti router, which does not run AirOS',
        { kind: 'ROUTER' as const },
        BACKUP_REFUSALS.UNSUPPORTED_VENDOR
      ]
    ])(
      'should refuse %s without asking it',
      async (_l, over, error) => {
        const candidate = makeCandidate(over);

        const result = await service.backUp(
          candidate,
          BackupTrigger.MANUAL,
          NOW
        );

        expect(result.value).toEqual({
          outcome: BackupOutcome.FAILED,
          error,
          refused: true
        });
        expect(fetcher.calls).toHaveLength(0);
        expect(stateOf(candidate.deviceId)?.lastError).toBe(error);
      }
    );
  });

  describe('failing alert for refused devices', () => {
    const refuseThreeNights = async (
      over: Parameters<typeof makeCandidate>[0]
    ) => {
      const candidate = makeCandidate(over);
      for (let night = 0; night < 3; night++)
        await service.backUp(
          candidate,
          BackupTrigger.SCHEDULED,
          new Date(NOW.getTime() + night * DAY)
        );
      return stateOf(candidate.deviceId)!;
    };

    it.each([
      ['not a main device', { kind: null }],
      ['out of reach', { reach: { by: 'none' as const } }],
      ['an unsupported vendor', { vendorSlug: 'mimosa' }]
    ])(
      '[BKP-063] should stay quiet for %s, which is not available yet',
      async (_label, over) => {
        const state = await refuseThreeNights(over);

        expect(state.consecutiveFailures).toBe(3);
        expect(state.domainEvents).toHaveLength(0);
      }
    );

    it.each([
      ['no IP address', { ipAddress: null }],
      ['no credentials', { credentials: null }]
    ])(
      '[BKP-063] should still announce %s, which someone can fix',
      async (_label, over) => {
        const state = await refuseThreeNights(over);

        expect(state.domainEvents).toHaveLength(1);
        expect(state.domainEvents[0]).toBeInstanceOf(
          DeviceBackupFailingEvent
        );
      }
    );
  });
  describe('through the agent (BKP-016)', () => {
    const ROUTEROS_EXPORT =
      '# 2026-10-07 03:00:01 by RouterOS 7.15\n/ip address\nadd address=10.0.0.1/24\n';
    let agent: jest.Mocked<IAgentConfigFetcher>;

    const behindAgent = (
      over: Parameters<typeof makeCandidate>[0] = {}
    ) =>
      makeCandidate({
        vendorSlug: 'mikrotik',
        kind: 'ROUTER',
        ipAddress: '10.0.0.1',
        reach: { by: 'agent', agentId: 'agent-1' },
        ...over
      });

    const answer = (value: AgentConfigAnswer) =>
      agent.fetch.mockResolvedValue(value);

    beforeEach(() => {
      agent = { fetch: jest.fn() };
      answer({
        kind: 'fetched',
        config: {
          format: BackupFormat.ROUTEROS_EXPORT,
          content: ROUTEROS_EXPORT
        }
      });
      service = new DeviceConfigBackupService(
        fetcher,
        backups,
        states,
        agent
      );
    });

    it('[BKP-016] should save what the agent read, without asking the device itself', async () => {
      const candidate = behindAgent();

      const result = await service.backUp(
        candidate,
        BackupTrigger.SCHEDULED,
        NOW
      );

      expect(result.value.outcome).toBe(BackupOutcome.SAVED);
      expect(backups.rows[0].content).toBe(ROUTEROS_EXPORT);
      expect(backups.rows[0].backup.format).toBe(
        BackupFormat.ROUTEROS_EXPORT
      );
      expect(fetcher.calls).toHaveLength(0);
      expect(agent.fetch).toHaveBeenCalledWith('agent-1', {
        ipAddress: '10.0.0.1',
        vendorSlug: 'mikrotik',
        kind: 'ROUTER',
        credentials: candidate.credentials
      });
    });

    it('[BKP-016] should refuse a kind of device its vendor has no backup for without asking the agent', async () => {
      const result = await service.backUp(
        behindAgent({ vendorSlug: 'ubiquiti' }),
        BackupTrigger.MANUAL,
        NOW
      );

      expect(result.value).toEqual({
        outcome: BackupOutcome.FAILED,
        error: BACKUP_REFUSALS.UNSUPPORTED_VENDOR,
        refused: true
      });
      expect(agent.fetch).not.toHaveBeenCalled();
    });

    it.each([
      ['AGENT_OFFLINE' as const, AGENT_BACKUP_FAILURES.AGENT_OFFLINE],
      ['TIMEOUT' as const, AGENT_BACKUP_FAILURES.TIMEOUT],
      [
        'AGENT_ERROR' as const,
        'SSH login rejected: check the device username and password'
      ]
    ])(
      '[BKP-016] should record %s as a failed attempt',
      async (reason, error) => {
        answer({
          kind: 'refused',
          reason,
          error:
            'SSH login rejected: check the device username and password'
        });
        const candidate = behindAgent();

        const result = await service.backUp(
          candidate,
          BackupTrigger.MANUAL,
          NOW
        );

        expect(result.value).toEqual({
          outcome: BackupOutcome.FAILED,
          error,
          refused: false
        });
        expect(stateOf(candidate.deviceId)?.lastError).toBe(error);
      }
    );

    it('[BKP-016] should record an agent too old to take backups as refused', async () => {
      answer({
        kind: 'refused',
        reason: 'PROBE_UNSUPPORTED',
        error: 'The agent must be updated to take backups'
      });

      const result = await service.backUp(
        behindAgent(),
        BackupTrigger.MANUAL,
        NOW
      );

      expect(result.value).toEqual({
        outcome: BackupOutcome.FAILED,
        error: AGENT_BACKUP_FAILURES.PROBE_UNSUPPORTED,
        refused: true
      });
    });

    it('[BKP-063] should stay quiet while the agent is too old to take backups', async () => {
      answer({
        kind: 'refused',
        reason: 'PROBE_UNSUPPORTED',
        error: 'The agent must be updated to take backups'
      });
      const candidate = behindAgent();

      for (let night = 0; night < 3; night++)
        await service.backUp(
          candidate,
          BackupTrigger.SCHEDULED,
          new Date(NOW.getTime() + night * DAY)
        );

      const state = stateOf(candidate.deviceId)!;
      expect(state.consecutiveFailures).toBe(3);
      expect(state.domainEvents).toHaveLength(0);
    });

    it('[BKP-061] should announce an agent offline three nights in a row', async () => {
      answer({
        kind: 'refused',
        reason: 'AGENT_OFFLINE',
        error: 'The agent is not connected'
      });
      const candidate = behindAgent();

      for (let night = 0; night < 3; night++)
        await service.backUp(
          candidate,
          BackupTrigger.SCHEDULED,
          new Date(NOW.getTime() + night * DAY)
        );

      expect(
        stateOf(candidate.deviceId)!.domainEvents[0]
      ).toBeInstanceOf(DeviceBackupFailingEvent);
    });
  });
});
