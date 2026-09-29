import { PrismaClient } from '../../../../src/generated/prisma/client';
import { IngestPingResultsUseCase } from 'application/device-monitoring/use-cases/IngestPingResultsUseCase';
import { PingCycleOutcome } from 'application/device-monitoring/services';
import { PrismaPollingConfigurationRepository } from 'infrastructure/persistence/PrismaPollingConfigurationRepository';
import { PrismaPingResultRepository } from 'infrastructure/persistence/PrismaPingResultRepository';
import { PrismaDeviceStateRepository } from 'infrastructure/persistence/PrismaDeviceStateRepository';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import {
  cleanDatabase,
  seedDeviceModel,
  seedMonitoredDevice,
  INVALID_ID
} from '../../helpers/db';

const MEASURED_AT = new Date('2026-09-28T12:00:00.000Z');

const measured = (
  isReachable: boolean,
  latencyMs: number | null = isReachable ? 12 : null
): PingCycleOutcome => ({
  kind: 'measured',
  isReachable,
  latencyMs,
  attempts: 1
});

const probeUnavailable: PingCycleOutcome = {
  kind: 'probe-unavailable',
  error: 'spawn ENOENT',
  attempts: 3
};

describe('IngestPingResultsUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: IngestPingResultsUseCase;
  let deviceModelId: string;
  let deviceId: string;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();
    deviceModelId = await seedDeviceModel(prisma);

    useCase = new IngestPingResultsUseCase(
      new PrismaPollingConfigurationRepository(prisma),
      new PrismaPingResultRepository(prisma),
      new PrismaDeviceStateRepository(prisma),
      new WinstonLogger()
    );
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    ({ deviceId } = await seedMonitoredDevice(prisma, deviceModelId));
  });

  const stateRow = () =>
    prisma.deviceState.findUnique({ where: { deviceId } });
  const pingRows = () =>
    prisma.pingResult.findMany({ where: { deviceId } });
  const configRow = () =>
    prisma.pollingConfiguration.findUnique({ where: { deviceId } });

  it('stores the sample and the state at the time it was measured', async () => {
    const result = await useCase.execute({
      deviceId,
      outcome: measured(true, 12),
      measuredAt: MEASURED_AT
    });

    expect(result.value).toEqual({
      status: 'APPLIED',
      isOnline: true,
      consecutiveFailures: 0
    });

    const pings = await pingRows();
    expect(pings).toHaveLength(1);
    expect(pings[0].isReachable).toBe(true);
    expect(Number(pings[0].latencyMs)).toBe(12);
    expect(pings[0].checkedAt).toEqual(MEASURED_AT);

    const state = await stateRow();
    expect(state!.status).toBe('UP');
    expect(state!.lastCheckedAt).toEqual(MEASURED_AT);

    expect((await configRow())!.lastPolledAt).toEqual(MEASURED_AT);
  });

  it('marks a device DOWN from its first unreachable result', async () => {
    await useCase.execute({
      deviceId,
      outcome: measured(false),
      measuredAt: MEASURED_AT
    });

    const state = await stateRow();
    expect(state!.status).toBe('DOWN');
    expect(state!.consecutiveFailures).toBe(1);
    expect(state!.downSince).toEqual(MEASURED_AT);
  });

  it('[MON-002] skips a result for a device whose monitoring was turned off', async () => {
    await prisma.pollingConfiguration.update({
      where: { deviceId },
      data: { enabled: false }
    });

    const result = await useCase.execute({
      deviceId,
      outcome: measured(false),
      measuredAt: MEASURED_AT
    });

    expect(result.value).toEqual({ status: 'SKIPPED' });
    expect(await pingRows()).toHaveLength(0);
    expect(await stateRow()).toBeNull();
  });

  describe('the probe could not run', () => {
    it('keeps a known device status and only advances lastCheckedAt', async () => {
      await useCase.execute({
        deviceId,
        outcome: measured(true),
        measuredAt: new Date(MEASURED_AT.getTime() - 60_000)
      });

      const result = await useCase.execute({
        deviceId,
        outcome: probeUnavailable,
        measuredAt: MEASURED_AT
      });

      expect(result.value).toEqual({ status: 'PROBE_UNAVAILABLE' });
      const state = await stateRow();
      expect(state!.status).toBe('UP');
      expect(state!.consecutiveFailures).toBe(0);
      expect(state!.lastCheckedAt).toEqual(MEASURED_AT);
      expect(await pingRows()).toHaveLength(1);
    });

    it('creates no state row for a device never polled', async () => {
      await useCase.execute({
        deviceId,
        outcome: probeUnavailable,
        measuredAt: MEASURED_AT
      });

      expect(await stateRow()).toBeNull();
      expect(await pingRows()).toHaveLength(0);
    });
  });

  it('fails on a malformed device id', async () => {
    const result = await useCase.execute({
      deviceId: INVALID_ID,
      outcome: measured(true),
      measuredAt: MEASURED_AT
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Invalid device ID');
  });

  describe('a result sent in by an agent', () => {
    const fromAgent = (
      resultId: string,
      measuredAt: Date,
      receivedAt: Date,
      isReachable = false
    ) =>
      useCase.execute({
        deviceId,
        outcome: measured(isReachable),
        measuredAt,
        source: { resultId, receivedAt }
      });

    it('[MON-007] a second copy is a duplicate: one row, state untouched', async () => {
      await fromAgent('agent-res-1', MEASURED_AT, MEASURED_AT);
      const before = await stateRow();

      const again = await fromAgent(
        'agent-res-1',
        MEASURED_AT,
        MEASURED_AT
      );

      expect(again.value.status).toBe('DUPLICATE');
      expect(await pingRows()).toHaveLength(1);
      expect((await stateRow())!.updatedAt).toEqual(
        before!.updatedAt
      );
    });

    it('[MON-007] stores the source id with the sample', async () => {
      await fromAgent('agent-res-2', MEASURED_AT, MEASURED_AT);

      const row = await prisma.pingResult.findFirst({
        where: { deviceId }
      });
      expect(row!.sourceResultId).toBe('agent-res-2');
    });

    it('[MON-008] a result older than 2 minutes on arrival is history only', async () => {
      const result = await fromAgent(
        'agent-res-3',
        MEASURED_AT,
        new Date(MEASURED_AT.getTime() + 3 * 60_000)
      );

      expect(result.value.status).toBe('HISTORY_ONLY');
      expect(await pingRows()).toHaveLength(1);
      expect(await stateRow()).toBeNull();
    });
  });
});
