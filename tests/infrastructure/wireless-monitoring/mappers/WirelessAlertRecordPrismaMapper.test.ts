// Source: src/infrastructure/wireless-monitoring/mappers/WirelessAlertRecordPrismaMapper.ts

import { WirelessAlertRecordPrismaMapper } from '../../../../src/infrastructure/wireless-monitoring/mappers/WirelessAlertRecordPrismaMapper';
import { WirelessAlertRecord } from 'domain/wireless-monitoring';
import { DeviceId } from 'domain/shared';
import { WirelessAlertRecordId } from 'domain/shared/ids';

const DEVICE_UUID = 'f149790a-58f0-479a-8534-b0b01e9942bb';
const RECORD_UUID  = '6c2bb658-cce2-4dde-b81e-029d5856e42a';

type PrismaWirelessAlertRecord = Parameters<typeof WirelessAlertRecordPrismaMapper.toDomain>[0];

// Prisma Decimal mock
const decimal = (value: number): { toNumber(): number } => ({ toNumber: () => value });

const makeActiveRow = (): PrismaWirelessAlertRecord => ({
  id: RECORD_UUID,
  deviceId: DEVICE_UUID,
  metric: 'signalRxDbm',
  severity: 'WARNING',
  threshold: decimal(-70),
  triggeredAt: new Date('2024-01-01T10:00:00Z'),
  clearedAt: null,
  isActive: true,
  lastValue: decimal(-75),
  message: 'Signal below threshold',
  notifiedAt: null,
});

const makeClearedRow = (): PrismaWirelessAlertRecord => ({
  ...makeActiveRow(),
  isActive: false,
  clearedAt: new Date('2024-01-01T11:00:00Z'),
});

const buildDomainRecord = (): WirelessAlertRecord => {
  const deviceId = DeviceId.parse(DEVICE_UUID).value;
  const id = WirelessAlertRecordId.parse(RECORD_UUID).value;

  return WirelessAlertRecord.reconstitute(
    id,
    {
      deviceId,
      metric: 'signalRxDbm',
      severity: 'WARNING',
      threshold: -70,
      triggeredAt: new Date('2024-01-01T10:00:00Z'),
      clearedAt: null,
      isActive: true,
      lastValue: -75,
      message: 'Signal below threshold',
      notifiedAt: null,
    }
  );
};

describe('WirelessAlertRecordPrismaMapper', () => {
  describe('toDomain', () => {
    it('should map all fields from an active Prisma row to the domain aggregate', () => {
      const record = WirelessAlertRecordPrismaMapper.toDomain(makeActiveRow());

      expect(record.id.toString()).toBe(RECORD_UUID);
      expect(record.deviceId.toString()).toBe(DEVICE_UUID);
      expect(record.metric).toBe('signalRxDbm');
      expect(record.severity).toBe('WARNING');
      expect(record.threshold).toBe(-70);
      expect(record.triggeredAt).toEqual(new Date('2024-01-01T10:00:00Z'));
      expect(record.clearedAt).toBeNull();
      expect(record.isActive).toBe(true);
      expect(record.lastValue).toBe(-75);
      expect(record.message).toBe('Signal below threshold');
    });

    it('should call toNumber() on the threshold Decimal field', () => {
      const toNumberSpy = jest.fn(() => -70);
      const row = { ...makeActiveRow(), threshold: { toNumber: toNumberSpy } };

      const record = WirelessAlertRecordPrismaMapper.toDomain(row);

      expect(toNumberSpy).toHaveBeenCalledTimes(1);
      expect(record.threshold).toBe(-70);
    });

    it('should call toNumber() on the lastValue Decimal field', () => {
      const toNumberSpy = jest.fn(() => -75);
      const row = { ...makeActiveRow(), lastValue: { toNumber: toNumberSpy } };

      const record = WirelessAlertRecordPrismaMapper.toDomain(row);

      expect(toNumberSpy).toHaveBeenCalledTimes(1);
      expect(record.lastValue).toBe(-75);
    });

    it('should map isActive as false and populate clearedAt for a cleared record', () => {
      const record = WirelessAlertRecordPrismaMapper.toDomain(makeClearedRow());

      expect(record.isActive).toBe(false);
      expect(record.clearedAt).toEqual(new Date('2024-01-01T11:00:00Z'));
    });

    it('should map CRITICAL severity correctly', () => {
      const row = { ...makeActiveRow(), severity: 'CRITICAL' };

      const record = WirelessAlertRecordPrismaMapper.toDomain(row);

      expect(record.severity).toBe('CRITICAL');
    });

    it('should throw when the deviceId is not a valid UUID', () => {
      const row = { ...makeActiveRow(), deviceId: 'invalid-id' };

      expect(() => WirelessAlertRecordPrismaMapper.toDomain(row)).toThrow('Invalid device ID');
    });

    it('should throw when the alert record id is not a valid UUID', () => {
      const row = { ...makeActiveRow(), id: 'bad-uuid' };

      expect(() => WirelessAlertRecordPrismaMapper.toDomain(row)).toThrow('Invalid alert record ID');
    });
  });

  describe('toPersistence', () => {
    it('should map all domain aggregate fields to the persistence shape', () => {
      const record = buildDomainRecord();

      const data = WirelessAlertRecordPrismaMapper.toPersistence(record);

      expect(data.id).toBe(RECORD_UUID);
      expect(data.deviceId).toBe(DEVICE_UUID);
      expect(data.metric).toBe('signalRxDbm');
      expect(data.severity).toBe('WARNING');
      expect(data.threshold).toBe(-70);
      expect(data.triggeredAt).toEqual(new Date('2024-01-01T10:00:00Z'));
      expect(data.clearedAt).toBeNull();
      expect(data.isActive).toBe(true);
      expect(data.lastValue).toBe(-75);
      expect(data.message).toBe('Signal below threshold');
    });

    it('should persist clearedAt as a Date object when the alert has been cleared', () => {
      const deviceId = DeviceId.parse(DEVICE_UUID).value;
      const id = WirelessAlertRecordId.parse(RECORD_UUID).value;
      const clearedDate = new Date('2024-01-01T11:00:00Z');

      const record = WirelessAlertRecord.reconstitute(
        id,
        {
          deviceId,
          metric: 'signalRxDbm',
          severity: 'CRITICAL',
          threshold: -75,
          triggeredAt: new Date('2024-01-01T10:00:00Z'),
          clearedAt: clearedDate,
          isActive: false,
          lastValue: -80,
          message: 'Critical signal',
          notifiedAt: null,
        }
      );

      const data = WirelessAlertRecordPrismaMapper.toPersistence(record);

      expect(data.clearedAt).toEqual(clearedDate);
      expect(data.isActive).toBe(false);
    });
  });

  describe('round-trip: toDomain → toPersistence', () => {
    it('should produce persistence data with matching fields after a round-trip from an active row', () => {
      const row = makeActiveRow();
      const record = WirelessAlertRecordPrismaMapper.toDomain(row);
      const back = WirelessAlertRecordPrismaMapper.toPersistence(record);

      expect(back.id).toBe(row.id);
      expect(back.deviceId).toBe(row.deviceId);
      expect(back.metric).toBe(row.metric);
      expect(back.severity).toBe(row.severity);
      expect(back.threshold).toBe(row.threshold.toNumber());
      expect(back.lastValue).toBe(row.lastValue.toNumber());
      expect(back.isActive).toBe(row.isActive);
      expect(back.clearedAt).toBe(row.clearedAt);
      expect(back.message).toBe(row.message);
    });

    it('should preserve clearedAt through a round-trip from a cleared row', () => {
      const row = makeClearedRow();
      const record = WirelessAlertRecordPrismaMapper.toDomain(row);
      const back = WirelessAlertRecordPrismaMapper.toPersistence(record);

      expect(back.clearedAt).toEqual(row.clearedAt);
      expect(back.isActive).toBe(false);
    });
  });
});
