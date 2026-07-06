// Source: src/application/wireless-monitoring/use-cases/GetActiveWirelessAlertsUseCase.ts

import { GetActiveWirelessAlertsUseCase } from '../../../../src/application/wireless-monitoring/use-cases/GetActiveWirelessAlertsUseCase';
import { IWirelessAlertRecordRepository } from '../../../../src/domain/wireless-monitoring/repository/IWirelessAlertRecordRepository';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';
import { Result } from '../../../../src/domain/shared/core/Result';
import { DeviceId, WirelessAlertRecordId } from '../../../../src/domain/shared/ids';
import { WirelessAlertRecord } from '../../../../src/domain/wireless-monitoring';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_DEVICE_UUID = '550e8400-e29b-41d4-a716-446655440001';
const VALID_DEVICE_UUID_2 = '550e8400-e29b-41d4-a716-446655440004';
const ALERT_UUID = '550e8400-e29b-41d4-a716-446655440002';
const ALERT_UUID_2 = '550e8400-e29b-41d4-a716-446655440003';

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

function makeAlertRecord(
  alertUuid: string,
  deviceUuid: string,
  metric = 'signal_rx_dbm'
): WirelessAlertRecord {
  const deviceId = DeviceId.parse(deviceUuid).value;
  const alertId = WirelessAlertRecordId.parse(alertUuid).value;
  return WirelessAlertRecord.reconstitute(
    alertId,
    {
      deviceId,
      metric,
      severity: 'WARNING',
      threshold: -70,
      lastValue: -75,
      message: 'Signal below threshold',
      triggeredAt: new Date('2024-01-01T00:00:00.000Z'),
      clearedAt: null,
      isActive: true,
    }
  );
}

// ---------------------------------------------------------------------------

describe('GetActiveWirelessAlertsUseCase', () => {
  let alertRecordRepo: jest.Mocked<IWirelessAlertRecordRepository>;
  let logger: jest.Mocked<ILogger>;
  let useCase: GetActiveWirelessAlertsUseCase;

  beforeEach(() => {
    alertRecordRepo = {
      save: jest.fn(),
      findById: jest.fn(),
      exists: jest.fn(),
      findActiveByDeviceAndMetric: jest.fn(),
      findAllActiveByDevice: jest.fn(),
      findAllActive: jest.fn(),
      findHistoryByDevice: jest.fn(),
      deleteClearedOlderThan: jest.fn()
    };

    logger = makeLogger();
    useCase = new GetActiveWirelessAlertsUseCase(alertRecordRepo, logger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // NOTE: GetActiveWirelessAlertsUseCase does not override beforeExecute, so
  // there are no beforeExecute validation tests. The deviceId is optional.

  // ===========================================================================
  describe('executeImpl — with deviceId provided (device-scoped query)', () => {
    it('should fail when deviceId is provided but is not a valid UUID', async () => {
      const result = await useCase.execute({ deviceId: 'not-a-uuid' });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid device ID');
    });

    it('should call alertRecordRepo.findAllActiveByDevice when a valid deviceId is provided', async () => {
      alertRecordRepo.findAllActiveByDevice.mockResolvedValue(Result.ok([]));

      await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      expect(alertRecordRepo.findAllActiveByDevice).toHaveBeenCalledTimes(1);
    });

    it('should NOT call alertRecordRepo.findAllActive when deviceId is provided', async () => {
      alertRecordRepo.findAllActiveByDevice.mockResolvedValue(Result.ok([]));

      await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      expect(alertRecordRepo.findAllActive).not.toHaveBeenCalled();
    });

    it('should call findAllActiveByDevice with the parsed deviceId', async () => {
      alertRecordRepo.findAllActiveByDevice.mockResolvedValue(Result.ok([]));

      await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      const calledWith = alertRecordRepo.findAllActiveByDevice.mock.calls[0][0];
      expect(calledWith.toString()).toBe(VALID_DEVICE_UUID);
    });

    it('should fail when findAllActiveByDevice returns a failure', async () => {
      alertRecordRepo.findAllActiveByDevice.mockResolvedValue(Result.fail('DB error'));

      const result = await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Failed to load active alerts');
    });

    it('should return an empty array when the device has no active alerts', async () => {
      alertRecordRepo.findAllActiveByDevice.mockResolvedValue(Result.ok([]));

      const result = await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      expect(result.isSuccess).toBe(true);
      expect(result.value).toHaveLength(0);
    });

    it('should return mapped DTOs for each active alert', async () => {
      const alerts = [
        makeAlertRecord(ALERT_UUID, VALID_DEVICE_UUID, 'signal_rx_dbm'),
        makeAlertRecord(ALERT_UUID_2, VALID_DEVICE_UUID, 'cpu_load_percent'),
      ];
      alertRecordRepo.findAllActiveByDevice.mockResolvedValue(Result.ok(alerts));

      const result = await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      expect(result.value).toHaveLength(2);
    });

    it('should map each alert to a DTO with the correct id', async () => {
      const alert = makeAlertRecord(ALERT_UUID, VALID_DEVICE_UUID, 'signal_rx_dbm');
      alertRecordRepo.findAllActiveByDevice.mockResolvedValue(Result.ok([alert]));

      const result = await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      expect(result.value[0].id).toBe(ALERT_UUID);
    });

    it('should map each alert to a DTO with the correct deviceId', async () => {
      const alert = makeAlertRecord(ALERT_UUID, VALID_DEVICE_UUID, 'signal_rx_dbm');
      alertRecordRepo.findAllActiveByDevice.mockResolvedValue(Result.ok([alert]));

      const result = await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      expect(result.value[0].deviceId).toBe(VALID_DEVICE_UUID);
    });

    it('should map each alert to a DTO with isActive=true', async () => {
      const alert = makeAlertRecord(ALERT_UUID, VALID_DEVICE_UUID, 'signal_rx_dbm');
      alertRecordRepo.findAllActiveByDevice.mockResolvedValue(Result.ok([alert]));

      const result = await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      expect(result.value[0].isActive).toBe(true);
    });
  });

  // ===========================================================================
  describe('executeImpl — without deviceId (system-wide query)', () => {
    it('should call alertRecordRepo.findAllActive when deviceId is absent', async () => {
      alertRecordRepo.findAllActive.mockResolvedValue(Result.ok([]));

      await useCase.execute({});

      expect(alertRecordRepo.findAllActive).toHaveBeenCalledTimes(1);
    });

    it('should NOT call alertRecordRepo.findAllActiveByDevice when deviceId is absent', async () => {
      alertRecordRepo.findAllActive.mockResolvedValue(Result.ok([]));

      await useCase.execute({});

      expect(alertRecordRepo.findAllActiveByDevice).not.toHaveBeenCalled();
    });

    it('should call alertRecordRepo.findAllActive when deviceId is undefined', async () => {
      alertRecordRepo.findAllActive.mockResolvedValue(Result.ok([]));

      await useCase.execute({ deviceId: undefined });

      expect(alertRecordRepo.findAllActive).toHaveBeenCalledTimes(1);
    });

    it('should fail when findAllActive returns a failure', async () => {
      alertRecordRepo.findAllActive.mockResolvedValue(Result.fail('DB timeout'));

      const result = await useCase.execute({});

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Failed to load active alerts');
    });

    it('should return an empty array when no active alerts exist system-wide', async () => {
      alertRecordRepo.findAllActive.mockResolvedValue(Result.ok([]));

      const result = await useCase.execute({});

      expect(result.isSuccess).toBe(true);
      expect(result.value).toHaveLength(0);
    });

    it('should return mapped DTOs for all active alerts across devices', async () => {
      const alerts = [
        makeAlertRecord(ALERT_UUID, VALID_DEVICE_UUID, 'signal_rx_dbm'),
        makeAlertRecord(ALERT_UUID_2, VALID_DEVICE_UUID_2, 'cpu_load_percent'),
      ];
      alertRecordRepo.findAllActive.mockResolvedValue(Result.ok(alerts));

      const result = await useCase.execute({});

      expect(result.value).toHaveLength(2);
    });

    it('should preserve alert ordering from the repository', async () => {
      const alert1 = makeAlertRecord(ALERT_UUID, VALID_DEVICE_UUID, 'signal_rx_dbm');
      const alert2 = makeAlertRecord(ALERT_UUID_2, VALID_DEVICE_UUID_2, 'cpu_load_percent');
      alertRecordRepo.findAllActive.mockResolvedValue(Result.ok([alert1, alert2]));

      const result = await useCase.execute({});

      expect(result.value[0].metric).toBe('signal_rx_dbm');
      expect(result.value[1].metric).toBe('cpu_load_percent');
    });
  });
});
