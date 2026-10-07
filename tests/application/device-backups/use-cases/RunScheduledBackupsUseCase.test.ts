// Source: src/application/device-backups/use-cases/RunScheduledBackupsUseCase.ts

import { Result } from '../../../../src/domain/shared/core/Result';
import {
  BACKUP_CONCURRENCY,
  BACKUP_FRESH_FOR_MS,
  RunScheduledBackupsUseCase
} from '../../../../src/application/device-backups/use-cases';
import { DeviceConfigBackupService } from '../../../../src/application/device-backups/services';
import {
  BackupCandidate,
  BackupCredentials,
  IBackupTargetsQuery
} from '../../../../src/application/device-backups/interfaces';
import {
  BackupFormat,
  BackupOutcome,
  DeviceBackupState
} from '../../../../src/domain/device-backups';
import { DeviceId } from '../../../../src/domain/shared/ids';
import {
  FakeFetcher,
  InMemoryConfigBackupRepository,
  InMemoryDeviceBackupStateRepository,
  makeCandidate,
  makeLogger
} from '../inMemoryBackups';

const NOW = new Date('2026-10-07T08:00:00Z');

class FixedTargets implements IBackupTargetsQuery {
  constructor(private readonly candidates: BackupCandidate[]) {}
  async listScheduled() {
    return Result.ok(this.candidates);
  }
  async findByDevice() {
    return Result.ok(null);
  }
}

describe('RunScheduledBackupsUseCase', () => {
  let fetcher: FakeFetcher;
  let states: InMemoryDeviceBackupStateRepository;

  beforeEach(() => {
    fetcher = new FakeFetcher();
    states = new InMemoryDeviceBackupStateRepository();
  });

  const build = (candidates: BackupCandidate[]) =>
    new RunScheduledBackupsUseCase(
      new FixedTargets(candidates),
      states,
      new DeviceConfigBackupService(
        fetcher,
        new InMemoryConfigBackupRepository(),
        states
      ),
      makeLogger()
    );

  const backedUpAt = async (candidate: BackupCandidate, at: Date) => {
    const state = DeviceBackupState.create(
      DeviceId.parse(candidate.deviceId).value
    ).value;
    state.recordSuccess(BackupOutcome.SAVED, at);
    await states.save(state);
  };

  it('[BKP-010] should back up every listed device', async () => {
    const run = await build([
      makeCandidate(),
      makeCandidate()
    ]).execute({
      now: NOW
    });

    expect(run.value).toEqual({
      saved: 2,
      unchanged: 0,
      skipped: 0,
      failed: []
    });
  });

  it('[BKP-012] should skip a device backed up within the window', async () => {
    const fresh = makeCandidate();
    await backedUpAt(
      fresh,
      new Date(NOW.getTime() - BACKUP_FRESH_FOR_MS + 60_000)
    );

    const run = await build([fresh]).execute({ now: NOW });

    expect(run.value.skipped).toBe(1);
    expect(fetcher.calls).toHaveLength(0);
  });

  it('[BKP-012] should back up a device whose last success is older than the window', async () => {
    const stale = makeCandidate();
    await backedUpAt(
      stale,
      new Date(NOW.getTime() - BACKUP_FRESH_FOR_MS - 60_000)
    );

    const run = await build([stale]).execute({ now: NOW });

    expect(run.value.saved).toBe(1);
  });

  it('[BKP-013] should go on after a device fails', async () => {
    const broken = makeCandidate({
      deviceName: 'AP Sin Clave',
      credentials: null
    });
    const fine = makeCandidate();

    const run = await build([broken, fine]).execute({ now: NOW });

    expect(run.value.saved).toBe(1);
    expect(run.value.failed).toEqual([
      {
        deviceId: broken.deviceId,
        deviceName: 'AP Sin Clave',
        error: 'No HTTP credentials are configured for this device'
      }
    ]);
  });

  it(`[BKP-013] should ask at most ${BACKUP_CONCURRENCY} devices at once`, async () => {
    let inFlight = 0;
    let peak = 0;
    const slow = {
      forVendor: () => slow,
      fetch: async (_ip: string, _c: BackupCredentials) => {
        inFlight++;
        peak = Math.max(peak, inFlight);
        await new Promise((r) => setTimeout(r, 5));
        inFlight--;
        return Result.ok({
          format: BackupFormat.AIROS_CFG,
          content: 'a=1\n'
        });
      }
    };
    const useCase = new RunScheduledBackupsUseCase(
      new FixedTargets(
        Array.from({ length: 10 }, () => makeCandidate())
      ),
      states,
      new DeviceConfigBackupService(
        slow,
        new InMemoryConfigBackupRepository(),
        states
      ),
      makeLogger()
    );

    const run = await useCase.execute({ now: NOW });

    expect(run.value.saved).toBe(10);
    expect(peak).toBe(BACKUP_CONCURRENCY);
  });

  it('should fail when the device list cannot be read', async () => {
    const useCase = new RunScheduledBackupsUseCase(
      {
        listScheduled: async () => Result.fail('db down'),
        findByDevice: async () => Result.ok(null)
      },
      states,
      new DeviceConfigBackupService(
        fetcher,
        new InMemoryConfigBackupRepository(),
        states
      ),
      makeLogger()
    );

    const run = await useCase.execute({ now: NOW });

    expect(run.isFailure).toBe(true);
  });
});
