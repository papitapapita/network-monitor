import { WirelessAlertRecord } from '../../../../src/domain/wireless-monitoring/aggregates/WirelessAlertRecord';
import { DeviceId } from '../../../../src/domain/shared/ids/DeviceId';

const DEVICE_UUID = '550e8400-e29b-41d4-a716-446655440001';
const NOTIFIED_AT = new Date('2024-06-01T10:00:00.000Z');

function makeRecord(): WirelessAlertRecord {
  return WirelessAlertRecord.open(
    DeviceId.parse(DEVICE_UUID).value,
    'signal_rx_dbm',
    'CRITICAL',
    -80,
    -83,
    'Señal crítica'
  ).value;
}

describe('[WLS-120] [WLS-125] WirelessAlertRecord — notification tracking', () => {
  describe('open', () => {
    it('should start un-notified', () => {
      const record = makeRecord();

      expect(record.notifiedAt).toBeNull();
      expect(record.isNotified).toBe(false);
    });
  });

  describe('markNotified', () => {
    it('should record the delivery timestamp', () => {
      const record = makeRecord();

      const result = record.markNotified(NOTIFIED_AT);

      expect(result.isSuccess).toBe(true);
      expect(record.notifiedAt).toEqual(NOTIFIED_AT);
      expect(record.isNotified).toBe(true);
    });

    it('should reject a second notification of the same alert', () => {
      const record = makeRecord();
      record.markNotified(NOTIFIED_AT);

      const result = record.markNotified(
        new Date('2024-06-01T11:00:00.000Z')
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('already been notified');
    });

    it('should keep the original timestamp after a rejected re-notify', () => {
      const record = makeRecord();
      record.markNotified(NOTIFIED_AT);

      record.markNotified(new Date('2024-06-01T11:00:00.000Z'));

      expect(record.notifiedAt).toEqual(NOTIFIED_AT);
    });

    it('should not raise a domain event', () => {
      const record = makeRecord();

      record.markNotified(NOTIFIED_AT);

      expect(record.domainEvents).toHaveLength(0);
    });
  });
});
