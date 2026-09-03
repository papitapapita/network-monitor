// Source: src/infrastructure/mappers/DeviceNotificationPolicyMapper.ts

import { DeviceNotificationPolicyMapper } from '../../../src/infrastructure/mappers/DeviceNotificationPolicyMapper';
import { DeviceNotificationPolicy } from '../../../src/domain/notifications/entities/DeviceNotificationPolicy';
import { DeviceNotificationPolicyId } from '../../../src/domain/shared/ids/DeviceNotificationPolicyId';
import { DeviceId } from '../../../src/domain/shared/ids/DeviceId';
import { QuietHours } from '../../../src/domain/notifications/value-objects/QuietHours';
import { TimeOfDay } from '../../../src/domain/notifications/value-objects/TimeOfDay';

const VALID_ID = '550e8400-e29b-41d4-a716-446655440096';
const VALID_DEVICE_ID = '550e8400-e29b-41d4-a716-446655440097';
const CREATED_AT = new Date('2026-01-01T00:00:00.000Z');
const UPDATED_AT = new Date('2026-01-02T00:00:00.000Z');

type RawRecord = {
  id: string;
  deviceId: string;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  alertDelayMinutes: number | null;
  createdAt: Date;
  updatedAt: Date;
};

function makeRawRecord(
  overrides: Partial<RawRecord> = {}
): RawRecord {
  return {
    id: VALID_ID,
    deviceId: VALID_DEVICE_ID,
    quietHoursStart: '22:00',
    quietHoursEnd: '07:00',
    alertDelayMinutes: 15,
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
    ...overrides
  };
}

function makeEntity(
  overrides: {
    quietHours?: QuietHours | null;
    alertDelayMinutes?: number | null;
  } = {}
): DeviceNotificationPolicy {
  return DeviceNotificationPolicy.reconstitute(
    DeviceNotificationPolicyId.parse(VALID_ID).value,
    {
      deviceId: DeviceId.parse(VALID_DEVICE_ID).value,
      quietHours:
        overrides.quietHours !== undefined
          ? overrides.quietHours
          : QuietHours.create(
              TimeOfDay.create('22:00').value,
              TimeOfDay.create('07:00').value
            ).value,
      alertDelayMinutes:
        overrides.alertDelayMinutes !== undefined
          ? overrides.alertDelayMinutes
          : 15,
      createdAt: CREATED_AT,
      updatedAt: UPDATED_AT
    }
  );
}

describe('DeviceNotificationPolicyMapper', () => {
  describe('toDomain()', () => {
    it('should map every field when a quiet-hours window is present', () => {
      const entity =
        DeviceNotificationPolicyMapper.toDomain(makeRawRecord());

      expect(entity.id.toString()).toBe(VALID_ID);
      expect(entity.deviceId.toString()).toBe(VALID_DEVICE_ID);
      expect(entity.quietHours?.start.toString()).toBe('22:00');
      expect(entity.quietHours?.end.toString()).toBe('07:00');
      expect(entity.alertDelayMinutes).toBe(15);
    });

    it('should map a null quiet-hours window to null', () => {
      const entity = DeviceNotificationPolicyMapper.toDomain(
        makeRawRecord({
          quietHoursStart: null,
          quietHoursEnd: null
        })
      );

      expect(entity.quietHours).toBeNull();
    });

    it('should map a null alertDelayMinutes to null', () => {
      const entity = DeviceNotificationPolicyMapper.toDomain(
        makeRawRecord({ alertDelayMinutes: null })
      );

      expect(entity.alertDelayMinutes).toBeNull();
    });

    it('should throw a data-integrity error for a malformed deviceId', () => {
      expect(() =>
        DeviceNotificationPolicyMapper.toDomain(
          makeRawRecord({ deviceId: 'not-a-uuid' })
        )
      ).toThrow('Data integrity violation');
    });

    it('should throw a data-integrity error for a malformed quiet-hours string', () => {
      expect(() =>
        DeviceNotificationPolicyMapper.toDomain(
          makeRawRecord({ quietHoursStart: '99:99' })
        )
      ).toThrow('Data integrity violation');
    });
  });

  describe('toPersistence()', () => {
    it('should serialize a configured window back to HH:mm strings', () => {
      const raw =
        DeviceNotificationPolicyMapper.toPersistence(makeEntity());

      expect(raw.quietHoursStart).toBe('22:00');
      expect(raw.quietHoursEnd).toBe('07:00');
    });

    it('should serialize no window as both fields null', () => {
      const raw = DeviceNotificationPolicyMapper.toPersistence(
        makeEntity({ quietHours: null })
      );

      expect(raw.quietHoursStart).toBeNull();
      expect(raw.quietHoursEnd).toBeNull();
    });
  });

  describe('round-trip', () => {
    it('should recover an equivalent entity from its serialized form', () => {
      const original = makeEntity({ alertDelayMinutes: 45 });

      const raw =
        DeviceNotificationPolicyMapper.toPersistence(original);
      const recovered = DeviceNotificationPolicyMapper.toDomain(raw);

      expect(recovered.quietHours?.start.toString()).toBe(
        original.quietHours?.start.toString()
      );
      expect(recovered.alertDelayMinutes).toBe(45);
    });
  });
});
