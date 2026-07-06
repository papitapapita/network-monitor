// Source: src/application/wireless-monitoring/mappers/WirelessAlertMapper.ts
import { WirelessAlertRecord } from 'domain/wireless-monitoring';
import { DeviceId, WirelessAlertRecordId } from 'domain/shared/ids';
import { WirelessAlertMapper } from 'application/wireless-monitoring/mappers';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ALERT_UUID   = '550e8400-e29b-41d4-a716-446655440000';
const DEVICE_UUID  = '550e8400-e29b-41d4-a716-446655440001';
const TRIGGERED_AT = new Date('2024-01-01T00:00:00.000Z');
const CLEARED_AT   = new Date('2024-01-01T06:00:00.000Z');

function makeAlertRecord(
  overrides: Partial<{
    severity:    'WARNING' | 'CRITICAL';
    metric:      string;
    threshold:   number;
    lastValue:   number;
    message:     string;
    triggeredAt: Date;
    clearedAt:   Date | null;
    isActive:    boolean;
  }> = {}
): WirelessAlertRecord {
  const id       = WirelessAlertRecordId.parse(ALERT_UUID).value!;
  const deviceId = DeviceId.parse(DEVICE_UUID).value!;

  return WirelessAlertRecord.reconstitute(
    id,
    {
      deviceId,
      metric:      'signalRxDbm',
      severity:    'WARNING',
      threshold:   -70,
      lastValue:   -75,
      message:     'Signal below threshold',
      triggeredAt: TRIGGERED_AT,
      clearedAt:   null,
      isActive:    true,
      ...overrides,
    }
  );
}

function makeClearedAlertRecord(): WirelessAlertRecord {
  return makeAlertRecord({ clearedAt: CLEARED_AT, isActive: false });
}

// ---------------------------------------------------------------------------

describe('WirelessAlertMapper', () => {
  describe('toDTO()', () => {
    describe('happy path — active alert, all fields present', () => {
      it('should map id to a string', () => {
        const record = makeAlertRecord();

        const dto = WirelessAlertMapper.toDTO(record);

        expect(dto.id).toBe(ALERT_UUID);
      });

      it('should map deviceId to a string', () => {
        const record = makeAlertRecord();

        const dto = WirelessAlertMapper.toDTO(record);

        expect(dto.deviceId).toBe(DEVICE_UUID);
      });

      it('should pass metric through unchanged', () => {
        const record = makeAlertRecord({ metric: 'signalRxDbm' });

        const dto = WirelessAlertMapper.toDTO(record);

        expect(dto.metric).toBe('signalRxDbm');
      });

      it('should pass threshold through unchanged', () => {
        const record = makeAlertRecord({ threshold: -70 });

        const dto = WirelessAlertMapper.toDTO(record);

        expect(dto.threshold).toBe(-70);
      });

      it('should pass lastValue through unchanged', () => {
        const record = makeAlertRecord({ lastValue: -75 });

        const dto = WirelessAlertMapper.toDTO(record);

        expect(dto.lastValue).toBe(-75);
      });

      it('should pass message through unchanged', () => {
        const record = makeAlertRecord({ message: 'Signal below threshold' });

        const dto = WirelessAlertMapper.toDTO(record);

        expect(dto.message).toBe('Signal below threshold');
      });

      it('should map triggeredAt to an ISO string', () => {
        const record = makeAlertRecord();

        const dto = WirelessAlertMapper.toDTO(record);

        expect(dto.triggeredAt).toBe('2024-01-01T00:00:00.000Z');
      });

      it('should map isActive to true for an active alert', () => {
        const record = makeAlertRecord({ isActive: true, clearedAt: null });

        const dto = WirelessAlertMapper.toDTO(record);

        expect(dto.isActive).toBe(true);
      });

      it('should map clearedAt to null when not set', () => {
        const record = makeAlertRecord({ clearedAt: null });

        const dto = WirelessAlertMapper.toDTO(record);

        expect(dto.clearedAt).toBeNull();
      });
    });

    // -----------------------------------------------------------------------
    describe('clearedAt field', () => {
      it('should map clearedAt to an ISO string when present', () => {
        const record = makeClearedAlertRecord();

        const dto = WirelessAlertMapper.toDTO(record);

        expect(dto.clearedAt).toBe('2024-01-01T06:00:00.000Z');
      });

      it('should map clearedAt to strictly null, not undefined, when absent', () => {
        const record = makeAlertRecord({ clearedAt: null });

        const dto = WirelessAlertMapper.toDTO(record);

        expect(dto.clearedAt).toStrictEqual(null);
      });
    });

    // -----------------------------------------------------------------------
    describe('isActive field', () => {
      it('should map isActive to false for a cleared alert', () => {
        const record = makeClearedAlertRecord();

        const dto = WirelessAlertMapper.toDTO(record);

        expect(dto.isActive).toBe(false);
      });
    });

    // -----------------------------------------------------------------------
    describe('severity variants', () => {
      it('should map severity WARNING correctly', () => {
        const record = makeAlertRecord({ severity: 'WARNING' });

        const dto = WirelessAlertMapper.toDTO(record);

        expect(dto.severity).toBe('WARNING');
      });

      it('should map severity CRITICAL correctly', () => {
        const record = makeAlertRecord({ severity: 'CRITICAL' });

        const dto = WirelessAlertMapper.toDTO(record);

        expect(dto.severity).toBe('CRITICAL');
      });
    });

    // -----------------------------------------------------------------------
    describe('metric variants', () => {
      it('should pass metric snrDb through unchanged', () => {
        const record = makeAlertRecord({ metric: 'snrDb' });

        const dto = WirelessAlertMapper.toDTO(record);

        expect(dto.metric).toBe('snrDb');
      });

      it('should pass metric cpuLoadPercent through unchanged', () => {
        const record = makeAlertRecord({ metric: 'cpuLoadPercent' });

        const dto = WirelessAlertMapper.toDTO(record);

        expect(dto.metric).toBe('cpuLoadPercent');
      });
    });

    // -----------------------------------------------------------------------
    describe('numeric boundary values', () => {
      it('should map threshold of zero correctly', () => {
        const record = makeAlertRecord({ threshold: 0 });

        const dto = WirelessAlertMapper.toDTO(record);

        expect(dto.threshold).toBe(0);
      });

      it('should map lastValue equal to threshold correctly', () => {
        const record = makeAlertRecord({ threshold: -70, lastValue: -70 });

        const dto = WirelessAlertMapper.toDTO(record);

        expect(dto.lastValue).toBe(-70);
      });
    });
  });

  // ===========================================================================
  describe('mapper compliance', () => {
    it('should expose toDTO as a static method', () => {
      expect(typeof WirelessAlertMapper.toDTO).toBe('function');
    });

    it('should produce identical output on repeated calls with the same record (deterministic)', () => {
      const record = makeAlertRecord();
      expect(WirelessAlertMapper.toDTO(record)).toEqual(WirelessAlertMapper.toDTO(record));
    });
  });
});
