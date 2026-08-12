// Source: src/application/wireless-monitoring/use-cases/GetWirelessDeviceStatusUseCase.ts

import { GetWirelessDeviceStatusUseCase } from '../../../../src/application/wireless-monitoring/use-cases/GetWirelessDeviceStatusUseCase';
import { IWirelessSnapshotRepository } from '../../../../src/domain/wireless-monitoring/repository/IWirelessSnapshotRepository';
import { IWirelessAlertRecordRepository } from '../../../../src/domain/wireless-monitoring/repository/IWirelessAlertRecordRepository';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';
import { Result } from '../../../../src/domain/shared/core/Result';
import { DeviceId, SnapshotId, WirelessAlertRecordId } from '../../../../src/domain/shared/ids';
import {
  WirelessSnapshot,
  WirelessAlertRecord,
} from '../../../../src/domain/wireless-monitoring';
import { WirelessMetrics } from '../../../../src/domain/wireless-monitoring/value-objects/WirelessMetrics';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_DEVICE_UUID = '550e8400-e29b-41d4-a716-446655440001';
const SNAPSHOT_UUID = '550e8400-e29b-41d4-a716-446655440002';
const ALERT_UUID = '550e8400-e29b-41d4-a716-446655440003';

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

function makeSnapshot(deviceType: 'STATION' | 'ACCESS_POINT' = 'STATION'): WirelessSnapshot {
  const deviceId = DeviceId.parse(VALID_DEVICE_UUID).value;
  const snapshotId = SnapshotId.parse(SNAPSHOT_UUID).value;
  return WirelessSnapshot.reconstitute(
    snapshotId,
    {
      deviceId,
      deviceType,
      collectedAt: new Date('2024-01-01T00:00:00.000Z'),
      collectionMethod: 'snmp',
      metrics: makeNullMetrics(),
      clients: [],
      alerts: [],
      remoteApDeviceId: null,
    }
  );
}

function makeAlertRecord(): WirelessAlertRecord {
  const deviceId = DeviceId.parse(VALID_DEVICE_UUID).value;
  const alertId = WirelessAlertRecordId.parse(ALERT_UUID).value;
  return WirelessAlertRecord.reconstitute(
    alertId,
    {
      deviceId,
      metric: 'signal_rx_dbm',
      severity: 'WARNING',
      threshold: -70,
      lastValue: -75,
      message: 'Signal below threshold',
      notifiedAt: null,
      triggeredAt: new Date('2024-01-01T00:00:00.000Z'),
      clearedAt: null,
      isActive: true,
    }
  );
}

// ---------------------------------------------------------------------------

describe('[WLS-140] GetWirelessDeviceStatusUseCase', () => {
  let snapshotRepo: jest.Mocked<IWirelessSnapshotRepository>;
  let alertRecordRepo: jest.Mocked<IWirelessAlertRecordRepository>;
  let logger: jest.Mocked<ILogger>;
  let useCase: GetWirelessDeviceStatusUseCase;

  beforeEach(() => {
    snapshotRepo = {
      save: jest.fn(),
      findById: jest.fn(),
      findLatestByDevice: jest.fn(),
      findLatestForAllDevices: jest.fn(),
      findHistoryByDevice: jest.fn(),
      deleteOlderThan: jest.fn()
    };

    alertRecordRepo = {
      save: jest.fn(),
      findById: jest.fn(),
      exists: jest.fn(),
      findActiveByDeviceMetricAndSeverity: jest.fn(),
      findAllActiveByDevice: jest.fn(),
    findActiveUnnotifiedByDevice: jest.fn(),
      findAllActive: jest.fn(),
      findHistoryByDevice: jest.fn(),
      deleteClearedOlderThan: jest.fn()
    };

    logger = makeLogger();
    useCase = new GetWirelessDeviceStatusUseCase(snapshotRepo, alertRecordRepo, logger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ===========================================================================
  describe('beforeExecute — request validation', () => {
    it('should fail when deviceId is empty', async () => {
      const result = await useCase.execute({ deviceId: '' });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Device ID is required');
    });

    it('should fail when deviceId is whitespace only', async () => {
      const result = await useCase.execute({ deviceId: '   ' });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Device ID is required');
    });

    it('should NOT call snapshotRepo when beforeExecute fails', async () => {
      await useCase.execute({ deviceId: '' });

      expect(snapshotRepo.findLatestByDevice).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  describe('executeImpl — device ID parsing', () => {
    it('should fail when deviceId is not a valid UUID', async () => {
      const result = await useCase.execute({ deviceId: 'not-a-uuid' });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid device ID');
    });
  });

  // ===========================================================================
  describe('executeImpl — snapshot loading', () => {
    it('should fail when snapshotRepo returns a failure', async () => {
      snapshotRepo.findLatestByDevice.mockResolvedValue(Result.fail('DB timeout'));

      const result = await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Failed to load wireless snapshot');
    });

    it('should fail when no snapshot exists for the device', async () => {
      snapshotRepo.findLatestByDevice.mockResolvedValue(Result.ok(null));

      const result = await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('No wireless data found for device');
    });

    it('should call snapshotRepo.findLatestByDevice with the parsed deviceId', async () => {
      snapshotRepo.findLatestByDevice.mockResolvedValue(Result.ok(makeSnapshot()));
      alertRecordRepo.findAllActiveByDevice.mockResolvedValue(Result.ok([]));

      await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      expect(snapshotRepo.findLatestByDevice).toHaveBeenCalledTimes(1);
      const calledWith = snapshotRepo.findLatestByDevice.mock.calls[0][0];
      expect(calledWith.toString()).toBe(VALID_DEVICE_UUID);
    });
  });

  // ===========================================================================
  describe('executeImpl — active alerts loading', () => {
    it('should call alertRecordRepo.findAllActiveByDevice with the parsed deviceId', async () => {
      snapshotRepo.findLatestByDevice.mockResolvedValue(Result.ok(makeSnapshot()));
      alertRecordRepo.findAllActiveByDevice.mockResolvedValue(Result.ok([]));

      await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      expect(alertRecordRepo.findAllActiveByDevice).toHaveBeenCalledTimes(1);
      const calledWith = alertRecordRepo.findAllActiveByDevice.mock.calls[0][0];
      expect(calledWith.toString()).toBe(VALID_DEVICE_UUID);
    });

    it('should use an empty alerts array when alertRecordRepo fails', async () => {
      snapshotRepo.findLatestByDevice.mockResolvedValue(Result.ok(makeSnapshot()));
      alertRecordRepo.findAllActiveByDevice.mockResolvedValue(Result.fail('DB unreachable'));

      const result = await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      expect(result.isSuccess).toBe(true);
      expect(result.value.activeAlerts).toHaveLength(0);
    });
  });

  // ===========================================================================
  describe('executeImpl — happy path response shape', () => {
    it('should return a successful Result', async () => {
      snapshotRepo.findLatestByDevice.mockResolvedValue(Result.ok(makeSnapshot()));
      alertRecordRepo.findAllActiveByDevice.mockResolvedValue(Result.ok([]));

      const result = await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      expect(result.isSuccess).toBe(true);
    });

    it('should include the deviceId in the response', async () => {
      snapshotRepo.findLatestByDevice.mockResolvedValue(Result.ok(makeSnapshot()));
      alertRecordRepo.findAllActiveByDevice.mockResolvedValue(Result.ok([]));

      const result = await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      expect(result.value.deviceId).toBe(VALID_DEVICE_UUID);
    });

    it('should include collectedAt as an ISO string', async () => {
      snapshotRepo.findLatestByDevice.mockResolvedValue(Result.ok(makeSnapshot()));
      alertRecordRepo.findAllActiveByDevice.mockResolvedValue(Result.ok([]));

      const result = await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      expect(result.value.collectedAt).toBe('2024-01-01T00:00:00.000Z');
    });

    it('should include the deviceType in the response', async () => {
      snapshotRepo.findLatestByDevice.mockResolvedValue(Result.ok(makeSnapshot('ACCESS_POINT')));
      alertRecordRepo.findAllActiveByDevice.mockResolvedValue(Result.ok([]));

      const result = await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      expect(result.value.deviceType).toBe('ACCESS_POINT');
    });

    it('should include an empty activeAlerts array when no active alerts exist', async () => {
      snapshotRepo.findLatestByDevice.mockResolvedValue(Result.ok(makeSnapshot()));
      alertRecordRepo.findAllActiveByDevice.mockResolvedValue(Result.ok([]));

      const result = await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      expect(result.value.activeAlerts).toHaveLength(0);
    });

    it('should map active alerts into the response', async () => {
      snapshotRepo.findLatestByDevice.mockResolvedValue(Result.ok(makeSnapshot()));
      alertRecordRepo.findAllActiveByDevice.mockResolvedValue(Result.ok([makeAlertRecord()]));

      const result = await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      expect(result.value.activeAlerts).toHaveLength(1);
      expect(result.value.activeAlerts[0].metric).toBe('signal_rx_dbm');
    });
  });
});
