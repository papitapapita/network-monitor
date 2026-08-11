import { WirelessAlertClearedAlertRecordHandler } from '../../../../src/application/wireless-monitoring/event-handlers/WirelessAlertClearedAlertRecordHandler';
import { IAlertRecorder } from '../../../../src/application/shared/interfaces/IAlertRecorder';
import { WirelessAlertClearedEvent } from '../../../../src/domain/wireless-monitoring/events/WirelessAlertCleared';
import { DeviceId, WirelessAlertRecordId } from '../../../../src/domain/shared/ids';
import { Result } from '../../../../src/domain/shared/core/Result';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';

const VALID_DEVICE_UUID = '550e8400-e29b-41d4-a716-446655440091';
const CLEARED_AT = new Date('2024-06-01T10:05:00.000Z');

function makeRecorder(): jest.Mocked<IAlertRecorder> {
  return {
    open: jest.fn().mockResolvedValue(Result.ok()),
    resolve: jest.fn().mockResolvedValue(Result.ok())
  };
}

function makeLogger(): jest.Mocked<ILogger> {
  return {
    info: jest.fn(), warn: jest.fn(), error: jest.fn(),
    debug: jest.fn(), child: jest.fn().mockReturnThis()
  } as unknown as jest.Mocked<ILogger>;
}

function makeEvent(
  severity: 'WARNING' | 'CRITICAL',
  metric = 'signal_rx_dbm'
): WirelessAlertClearedEvent {
  return new WirelessAlertClearedEvent({
    aggregateId: WirelessAlertRecordId.create(),
    deviceId: DeviceId.parse(VALID_DEVICE_UUID).value,
    metric,
    severity,
    clearedAt: CLEARED_AT,
    dateTimeOccurred: CLEARED_AT
  });
}

describe('[WLS-124] WirelessAlertClearedAlertRecordHandler', () => {
  let recorder: jest.Mocked<IAlertRecorder>;
  let logger: jest.Mocked<ILogger>;
  let handler: WirelessAlertClearedAlertRecordHandler;

  beforeEach(() => {
    recorder = makeRecorder();
    logger = makeLogger();
    handler = new WirelessAlertClearedAlertRecordHandler(recorder, logger);
  });

  it('should resolve the matching typed alert', async () => {
    await handler.handle(makeEvent('CRITICAL', 'lan_status'));
    expect(recorder.resolve).toHaveBeenCalledWith(
      VALID_DEVICE_UUID,
      'wireless:lan_status:CRITICAL',
      CLEARED_AT
    );
  });

  it('should log when resolve fails', async () => {
    recorder.resolve.mockResolvedValue(Result.fail('db down'));
    await handler.handle(makeEvent('CRITICAL'));
    expect(logger.error).toHaveBeenCalled();
  });

  it('should not throw when the recorder rejects', async () => {
    recorder.resolve.mockRejectedValue(new Error('boom'));
    await expect(
      handler.handle(makeEvent('CRITICAL'))
    ).resolves.toBeUndefined();
  });
});
