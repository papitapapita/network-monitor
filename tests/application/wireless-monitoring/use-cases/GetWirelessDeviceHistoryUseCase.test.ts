// Source: src/application/wireless-monitoring/use-cases/GetWirelessDeviceHistoryUseCase.ts

import { GetWirelessDeviceHistoryUseCase } from '../../../../src/application/wireless-monitoring/use-cases/GetWirelessDeviceHistoryUseCase';
import { IWirelessSnapshotRepository } from '../../../../src/domain/wireless-monitoring/repository/IWirelessSnapshotRepository';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';
import { Result } from '../../../../src/domain/shared/core/Result';
import { DeviceId, SnapshotId } from '../../../../src/domain/shared/ids';
import { WirelessSnapshot } from '../../../../src/domain/wireless-monitoring';
import { WirelessMetrics } from '../../../../src/domain/wireless-monitoring/value-objects/WirelessMetrics';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_DEVICE_UUID = '550e8400-e29b-41d4-a716-446655440001';
const SNAPSHOT_UUID_A = '550e8400-e29b-41d4-a716-446655440002';
const SNAPSHOT_UUID_B = '550e8400-e29b-41d4-a716-446655440003';
const FROM = new Date('2024-01-01T00:00:00.000Z');
const TO = new Date('2024-01-02T00:00:00.000Z');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeLogger(): jest.Mocked<ILogger> {
  const child: jest.Mocked<ILogger> = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
    setLevel: jest.fn(),
    child: jest.fn(),
  };
  child.child.mockReturnValue(child);
  return child;
}

function makeNullMetrics(): WirelessMetrics {
  return WirelessMetrics.reconstitute({
    signalRxDbm: null, signalTxDbm: null, noiseFloorDbm: null, snrDb: null,
    ccqPercent: null, frequencyMhz: null,
    channelWidthMhz: null, throughputTxBps: null,
    throughputRxBps: null, throughputTxPps: null, throughputRxPps: null,
    lanStatus: null, lanSpeedMbps: null, lanDuplex: null, uptimeSeconds: null,
    cpuLoadPercent: null, memoryUsedPercent: null, firmwareVersion: null,
    deviceName: null, remoteApMac: null, remoteApName: null, remoteApIp: null,
    distanceM: null, latencyMs: null, capacityTxKbps: null, capacityRxKbps: null,
    deviceTimeEpoch: null, clientsConnected: null,
    macAddress: null, deviceModel: null, ssid: null,
  });
}

function makeSnapshot(snapshotUuid: string, collectedAt: Date): WirelessSnapshot {
  const deviceId = DeviceId.parse(VALID_DEVICE_UUID).value;
  const snapshotId = SnapshotId.parse(snapshotUuid).value;
  return WirelessSnapshot.reconstitute(
    snapshotId,
    {
      deviceId,
      deviceType: 'STATION',
      collectedAt,
      collectionMethod: 'snmp',
      metrics: makeNullMetrics(),
      clients: [],
      alerts: [],
      remoteApDeviceId: null,
    }
  );
}

// ---------------------------------------------------------------------------

describe('GetWirelessDeviceHistoryUseCase', () => {
  let snapshotRepo: jest.Mocked<IWirelessSnapshotRepository>;
  let logger: jest.Mocked<ILogger>;
  let useCase: GetWirelessDeviceHistoryUseCase;

  beforeEach(() => {
    snapshotRepo = {
      save: jest.fn(),
      findById: jest.fn(),
      findLatestByDevice: jest.fn(),
      findHistoryByDevice: jest.fn(),
    };

    logger = makeLogger();
    useCase = new GetWirelessDeviceHistoryUseCase(snapshotRepo, logger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ===========================================================================
  describe('beforeExecute — request validation', () => {
    it('should fail when deviceId is empty', async () => {
      const result = await useCase.execute({ deviceId: '', from: FROM, to: TO });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Device ID is required');
    });

    it('should fail when deviceId is whitespace only', async () => {
      const result = await useCase.execute({ deviceId: '   ', from: FROM, to: TO });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Device ID is required');
    });

    it('should fail when from is equal to to', async () => {
      const sameDate = new Date('2024-01-01T00:00:00.000Z');

      const result = await useCase.execute({
        deviceId: VALID_DEVICE_UUID,
        from: sameDate,
        to: sameDate,
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('from must be before to');
    });

    it('should fail when from is after to', async () => {
      const result = await useCase.execute({
        deviceId: VALID_DEVICE_UUID,
        from: TO,
        to: FROM,
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('from must be before to');
    });

    it('should NOT call snapshotRepo when beforeExecute fails', async () => {
      await useCase.execute({ deviceId: '', from: FROM, to: TO });

      expect(snapshotRepo.findHistoryByDevice).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  describe('executeImpl — device ID parsing', () => {
    it('should fail when deviceId is not a valid UUID', async () => {
      const result = await useCase.execute({ deviceId: 'not-a-uuid', from: FROM, to: TO });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid device ID');
    });
  });

  // ===========================================================================
  describe('executeImpl — snapshot history loading', () => {
    it('should fail when snapshotRepo returns a failure', async () => {
      snapshotRepo.findHistoryByDevice.mockResolvedValue(Result.fail('DB timeout'));

      const result = await useCase.execute({ deviceId: VALID_DEVICE_UUID, from: FROM, to: TO });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Failed to load wireless history');
    });

    it('should call snapshotRepo.findHistoryByDevice with the parsed deviceId and time range', async () => {
      snapshotRepo.findHistoryByDevice.mockResolvedValue(Result.ok([]));

      await useCase.execute({ deviceId: VALID_DEVICE_UUID, from: FROM, to: TO });

      expect(snapshotRepo.findHistoryByDevice).toHaveBeenCalledWith(
        expect.objectContaining({ toString: expect.any(Function) }),
        FROM,
        TO
      );
      const calledWith = snapshotRepo.findHistoryByDevice.mock.calls[0][0];
      expect(calledWith.toString()).toBe(VALID_DEVICE_UUID);
    });
  });

  // ===========================================================================
  describe('executeImpl — happy path response shape', () => {
    it('should return a successful Result when snapshots exist', async () => {
      const snapshots = [
        makeSnapshot(SNAPSHOT_UUID_A, new Date('2024-01-01T01:00:00.000Z')),
        makeSnapshot(SNAPSHOT_UUID_B, new Date('2024-01-01T02:00:00.000Z')),
      ];
      snapshotRepo.findHistoryByDevice.mockResolvedValue(Result.ok(snapshots));

      const result = await useCase.execute({ deviceId: VALID_DEVICE_UUID, from: FROM, to: TO });

      expect(result.isSuccess).toBe(true);
    });

    it('should return total equal to the number of snapshots found', async () => {
      const snapshots = [
        makeSnapshot(SNAPSHOT_UUID_A, new Date('2024-01-01T01:00:00.000Z')),
        makeSnapshot(SNAPSHOT_UUID_B, new Date('2024-01-01T02:00:00.000Z')),
      ];
      snapshotRepo.findHistoryByDevice.mockResolvedValue(Result.ok(snapshots));

      const result = await useCase.execute({ deviceId: VALID_DEVICE_UUID, from: FROM, to: TO });

      expect(result.value.total).toBe(2);
    });

    it('should return snapshots array with length equal to total', async () => {
      const snapshots = [
        makeSnapshot(SNAPSHOT_UUID_A, new Date('2024-01-01T01:00:00.000Z')),
        makeSnapshot(SNAPSHOT_UUID_B, new Date('2024-01-01T02:00:00.000Z')),
      ];
      snapshotRepo.findHistoryByDevice.mockResolvedValue(Result.ok(snapshots));

      const result = await useCase.execute({ deviceId: VALID_DEVICE_UUID, from: FROM, to: TO });

      expect(result.value.snapshots).toHaveLength(2);
    });

    it('should return an empty snapshots array and total=0 when no snapshots are found', async () => {
      snapshotRepo.findHistoryByDevice.mockResolvedValue(Result.ok([]));

      const result = await useCase.execute({ deviceId: VALID_DEVICE_UUID, from: FROM, to: TO });

      expect(result.isSuccess).toBe(true);
      expect(result.value.snapshots).toHaveLength(0);
      expect(result.value.total).toBe(0);
    });

    it('should map each snapshot to a status DTO with the correct deviceId', async () => {
      snapshotRepo.findHistoryByDevice.mockResolvedValue(
        Result.ok([makeSnapshot(SNAPSHOT_UUID_A, new Date('2024-01-01T01:00:00.000Z'))])
      );

      const result = await useCase.execute({ deviceId: VALID_DEVICE_UUID, from: FROM, to: TO });

      expect(result.value.snapshots[0].deviceId).toBe(VALID_DEVICE_UUID);
    });

    it('should map each snapshot collectedAt to an ISO string', async () => {
      const collectedAt = new Date('2024-01-01T01:00:00.000Z');
      snapshotRepo.findHistoryByDevice.mockResolvedValue(
        Result.ok([makeSnapshot(SNAPSHOT_UUID_A, collectedAt)])
      );

      const result = await useCase.execute({ deviceId: VALID_DEVICE_UUID, from: FROM, to: TO });

      expect(result.value.snapshots[0].collectedAt).toBe('2024-01-01T01:00:00.000Z');
    });

    it('should preserve snapshot ordering from the repository', async () => {
      const first = makeSnapshot(SNAPSHOT_UUID_A, new Date('2024-01-01T01:00:00.000Z'));
      const second = makeSnapshot(SNAPSHOT_UUID_B, new Date('2024-01-01T02:00:00.000Z'));
      snapshotRepo.findHistoryByDevice.mockResolvedValue(Result.ok([first, second]));

      const result = await useCase.execute({ deviceId: VALID_DEVICE_UUID, from: FROM, to: TO });

      expect(result.value.snapshots[0].collectedAt).toBe('2024-01-01T01:00:00.000Z');
      expect(result.value.snapshots[1].collectedAt).toBe('2024-01-01T02:00:00.000Z');
    });

    it('should include an empty activeAlerts array in each mapped snapshot DTO', async () => {
      snapshotRepo.findHistoryByDevice.mockResolvedValue(
        Result.ok([makeSnapshot(SNAPSHOT_UUID_A, new Date('2024-01-01T01:00:00.000Z'))])
      );

      const result = await useCase.execute({ deviceId: VALID_DEVICE_UUID, from: FROM, to: TO });

      expect(result.value.snapshots[0].activeAlerts).toHaveLength(0);
    });
  });
});
