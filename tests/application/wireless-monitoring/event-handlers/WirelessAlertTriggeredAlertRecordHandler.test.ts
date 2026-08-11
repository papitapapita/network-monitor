import { WirelessAlertTriggeredAlertRecordHandler } from '../../../../src/application/wireless-monitoring/event-handlers/WirelessAlertTriggeredAlertRecordHandler';
import { IAlertRecorder } from '../../../../src/application/shared/interfaces/IAlertRecorder';
import { WirelessAlertTriggeredEvent } from '../../../../src/domain/wireless-monitoring/events/WirelessAlertTriggered';
import { WirelessAlert } from '../../../../src/domain/wireless-monitoring/value-objects/WirelessAlert';
import { DeviceId, SnapshotId } from '../../../../src/domain/shared/ids';
import { AlertSeverity } from '../../../../src/domain/shared/enums/AlertSeverity';
import { Result } from '../../../../src/domain/shared/core/Result';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';

const VALID_DEVICE_UUID = '550e8400-e29b-41d4-a716-446655440090';
const TRIGGERED_AT = new Date('2024-06-01T10:00:00.000Z');

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

function makeAlert(
  severity: 'WARNING' | 'CRITICAL',
  metric = 'signal_rx_dbm'
): WirelessAlert {
  return WirelessAlert.create({
    metric,
    severity,
    threshold: -80,
    currentValue: -83,
    message: 'Señal crítica',
    triggeredAt: TRIGGERED_AT
  }).value;
}

function makeEvent(alerts: WirelessAlert[]): WirelessAlertTriggeredEvent {
  return new WirelessAlertTriggeredEvent({
    aggregateId: SnapshotId.create(),
    deviceId: DeviceId.parse(VALID_DEVICE_UUID).value,
    alerts,
    dateTimeOccurred: TRIGGERED_AT
  });
}

describe('[WLS-124] WirelessAlertTriggeredAlertRecordHandler', () => {
  let recorder: jest.Mocked<IAlertRecorder>;
  let logger: jest.Mocked<ILogger>;
  let handler: WirelessAlertTriggeredAlertRecordHandler;

  beforeEach(() => {
    recorder = makeRecorder();
    logger = makeLogger();
    handler = new WirelessAlertTriggeredAlertRecordHandler(recorder, logger);
  });

  it('should record one alert per triggered wireless alert', async () => {
    await handler.handle(makeEvent([makeAlert('CRITICAL'), makeAlert('WARNING', 'throughput')]));
    expect(recorder.open).toHaveBeenCalledTimes(2);
  });

  it('should map metric, severity and details onto a typed alert', async () => {
    await handler.handle(makeEvent([makeAlert('CRITICAL')]));
    expect(recorder.open).toHaveBeenCalledWith(
      expect.objectContaining({
        deviceId: VALID_DEVICE_UUID,
        severity: AlertSeverity.CRITICAL,
        source: 'Enlace inalámbrico',
        type: 'wireless:signal_rx_dbm:CRITICAL',
        description: 'Señal crítica',
        details: expect.objectContaining({
          metric: 'signal_rx_dbm',
          threshold: -80,
          currentValue: -83
        })
      })
    );
  });

  it('should log and continue when a record fails', async () => {
    recorder.open.mockResolvedValue(Result.fail('db down'));
    await handler.handle(makeEvent([makeAlert('CRITICAL')]));
    expect(logger.error).toHaveBeenCalled();
  });

  it('should not throw when the recorder rejects', async () => {
    recorder.open.mockRejectedValue(new Error('boom'));
    await expect(
      handler.handle(makeEvent([makeAlert('CRITICAL')]))
    ).resolves.toBeUndefined();
  });
});
