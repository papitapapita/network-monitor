// Source: src/application/wireless-monitoring/use-cases/GetWirelessAlertHistoryUseCase.ts

import { GetWirelessAlertHistoryUseCase } from '../../../../src/application/wireless-monitoring/use-cases/GetWirelessAlertHistoryUseCase';
import { IWirelessAlertRecordRepository } from '../../../../src/domain/wireless-monitoring/repository/IWirelessAlertRecordRepository';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';
import { Result } from '../../../../src/domain/shared/core/Result';
import { DeviceId, WirelessAlertRecordId } from '../../../../src/domain/shared/ids';
import { WirelessAlertRecord } from '../../../../src/domain/wireless-monitoring';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_DEVICE_UUID = '550e8400-e29b-41d4-a716-446655440001';
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
  isActive = false,
  triggeredAt = new Date('2024-01-01T00:00:00.000Z'),
  clearedAt: Date | null = new Date('2024-01-01T01:00:00.000Z')
): WirelessAlertRecord {
  const deviceId = DeviceId.parse(VALID_DEVICE_UUID).value;
  const alertId = WirelessAlertRecordId.parse(alertUuid).value;
  return WirelessAlertRecord.reconstitute(
    alertId,
    {
      deviceId,
      metric: 'signal_rx_dbm',
      severity: 'WARNING',
      threshold: -70,
      lastValue: -65,
      message: 'Signal recovered',
      triggeredAt,
      clearedAt,
      isActive,
    }
  );
}

// ---------------------------------------------------------------------------

describe('GetWirelessAlertHistoryUseCase', () => {
  let alertRecordRepo: jest.Mocked<IWirelessAlertRecordRepository>;
  let logger: jest.Mocked<ILogger>;
  let useCase: GetWirelessAlertHistoryUseCase;

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
    useCase = new GetWirelessAlertHistoryUseCase(alertRecordRepo, logger);
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

    it('should NOT call alertRecordRepo when beforeExecute fails', async () => {
      await useCase.execute({ deviceId: '' });

      expect(alertRecordRepo.findHistoryByDevice).not.toHaveBeenCalled();
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
  describe('executeImpl — default from/to date handling', () => {
    it('should use epoch (new Date(0)) as from when from is not provided', async () => {
      alertRecordRepo.findHistoryByDevice.mockResolvedValue(Result.ok([]));

      await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      const calledFrom = alertRecordRepo.findHistoryByDevice.mock.calls[0][1];
      expect(calledFrom.getTime()).toBe(new Date(0).getTime());
    });

    it('should use a recent date as to when to is not provided', async () => {
      const before = Date.now();
      alertRecordRepo.findHistoryByDevice.mockResolvedValue(Result.ok([]));

      await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      const after = Date.now();
      const calledTo = alertRecordRepo.findHistoryByDevice.mock.calls[0][2] as Date;
      expect(calledTo.getTime()).toBeGreaterThanOrEqual(before);
      expect(calledTo.getTime()).toBeLessThanOrEqual(after);
    });

    it('should use the provided from date when supplied', async () => {
      alertRecordRepo.findHistoryByDevice.mockResolvedValue(Result.ok([]));
      const from = new Date('2023-06-01T00:00:00.000Z');

      await useCase.execute({ deviceId: VALID_DEVICE_UUID, from });

      const calledFrom = alertRecordRepo.findHistoryByDevice.mock.calls[0][1];
      expect(calledFrom).toEqual(from);
    });

    it('should use the provided to date when supplied', async () => {
      alertRecordRepo.findHistoryByDevice.mockResolvedValue(Result.ok([]));
      const to = new Date('2024-06-01T00:00:00.000Z');

      await useCase.execute({ deviceId: VALID_DEVICE_UUID, to });

      const calledTo = alertRecordRepo.findHistoryByDevice.mock.calls[0][2];
      expect(calledTo).toEqual(to);
    });
  });

  // ===========================================================================
  describe('executeImpl — limit parameter forwarding', () => {
    it('should pass limit to the repository when provided', async () => {
      alertRecordRepo.findHistoryByDevice.mockResolvedValue(Result.ok([]));

      await useCase.execute({ deviceId: VALID_DEVICE_UUID, limit: 25 });

      const calledLimit = alertRecordRepo.findHistoryByDevice.mock.calls[0][3];
      expect(calledLimit).toBe(25);
    });

    it('should pass undefined limit to the repository when not provided', async () => {
      alertRecordRepo.findHistoryByDevice.mockResolvedValue(Result.ok([]));

      await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      const calledLimit = alertRecordRepo.findHistoryByDevice.mock.calls[0][3];
      expect(calledLimit).toBeUndefined();
    });
  });

  // ===========================================================================
  describe('executeImpl — repository failure', () => {
    it('should fail when alertRecordRepo.findHistoryByDevice returns a failure', async () => {
      alertRecordRepo.findHistoryByDevice.mockResolvedValue(Result.fail('DB timeout'));

      const result = await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Failed to load alert history');
    });
  });

  // ===========================================================================
  describe('executeImpl — happy path response shape', () => {
    it('should return a successful Result', async () => {
      alertRecordRepo.findHistoryByDevice.mockResolvedValue(Result.ok([]));

      const result = await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      expect(result.isSuccess).toBe(true);
    });

    it('should return an empty array when no historical alerts exist', async () => {
      alertRecordRepo.findHistoryByDevice.mockResolvedValue(Result.ok([]));

      const result = await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      expect(result.value).toHaveLength(0);
    });

    it('should return mapped DTOs for each alert record', async () => {
      const alerts = [
        makeAlertRecord(ALERT_UUID),
        makeAlertRecord(ALERT_UUID_2),
      ];
      alertRecordRepo.findHistoryByDevice.mockResolvedValue(Result.ok(alerts));

      const result = await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      expect(result.value).toHaveLength(2);
    });

    it('should map each alert to a DTO with the correct id', async () => {
      const alert = makeAlertRecord(ALERT_UUID);
      alertRecordRepo.findHistoryByDevice.mockResolvedValue(Result.ok([alert]));

      const result = await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      expect(result.value[0].id).toBe(ALERT_UUID);
    });

    it('should map each alert to a DTO with the correct deviceId', async () => {
      const alert = makeAlertRecord(ALERT_UUID);
      alertRecordRepo.findHistoryByDevice.mockResolvedValue(Result.ok([alert]));

      const result = await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      expect(result.value[0].deviceId).toBe(VALID_DEVICE_UUID);
    });

    it('should map alert clearedAt to an ISO string when set', async () => {
      const clearedAt = new Date('2024-01-01T01:00:00.000Z');
      const alert = makeAlertRecord(ALERT_UUID, false, new Date('2024-01-01T00:00:00.000Z'), clearedAt);
      alertRecordRepo.findHistoryByDevice.mockResolvedValue(Result.ok([alert]));

      const result = await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      expect(result.value[0].clearedAt).toBe('2024-01-01T01:00:00.000Z');
    });

    it('should map alert clearedAt to null when not set', async () => {
      const alert = makeAlertRecord(ALERT_UUID, true, new Date('2024-01-01T00:00:00.000Z'), null);
      alertRecordRepo.findHistoryByDevice.mockResolvedValue(Result.ok([alert]));

      const result = await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      expect(result.value[0].clearedAt).toBeNull();
    });

    it('should preserve alert ordering from the repository', async () => {
      const alert1 = makeAlertRecord(ALERT_UUID, false, new Date('2024-01-01T00:00:00.000Z'));
      const alert2 = makeAlertRecord(ALERT_UUID_2, false, new Date('2024-01-02T00:00:00.000Z'));
      alertRecordRepo.findHistoryByDevice.mockResolvedValue(Result.ok([alert1, alert2]));

      const result = await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      expect(result.value[0].id).toBe(ALERT_UUID);
      expect(result.value[1].id).toBe(ALERT_UUID_2);
    });

    it('should call findHistoryByDevice with the parsed deviceId', async () => {
      alertRecordRepo.findHistoryByDevice.mockResolvedValue(Result.ok([]));

      await useCase.execute({ deviceId: VALID_DEVICE_UUID });

      const calledWith = alertRecordRepo.findHistoryByDevice.mock.calls[0][0];
      expect(calledWith.toString()).toBe(VALID_DEVICE_UUID);
    });
  });
});
