// Source: src/infrastructure/mappers/DeviceStateMapper.ts

import { DeviceStateMapper } from '../../../src/infrastructure/mappers/DeviceStateMapper';
import { DeviceState } from '../../../src/domain/device-monitoring/aggregates/DeviceState';
import { DeviceId } from '../../../src/domain/shared/ids/DeviceId';
import { DeviceStateProps } from '../../../src/domain/device-monitoring/props/DeviceStateProps';

// ---------------------------------------------------------------------------
// Constants & Fixtures
// ---------------------------------------------------------------------------

const VALID_DEVICE_UUID = '550e8400-e29b-41d4-a716-446655440001';
const VALID_ROW_ID      = 'db-row-uuid-001';
const FIXED_DATE        = new Date('2024-06-01T10:00:00.000Z');
const LATER_DATE        = new Date('2024-06-01T11:00:00.000Z');

type RawRow = {
  id:                  string;
  deviceId:            string;
  isOnline:            boolean;
  lastSeen:            Date | null;
  lastLatencyMs:       unknown;
  consecutiveFailures: number;
  lastCheckedAt:       Date | null;
  updatedAt:           Date;
};

function makeRawRow(overrides: Partial<RawRow> = {}): RawRow {
  return {
    id:                  VALID_ROW_ID,
    deviceId:            VALID_DEVICE_UUID,
    isOnline:            true,
    lastSeen:            FIXED_DATE,
    lastLatencyMs:       20,
    consecutiveFailures: 0,
    lastCheckedAt:       FIXED_DATE,
    updatedAt:           FIXED_DATE,
    ...overrides
  };
}

function makeDeviceId(): DeviceId {
  return DeviceId.parse(VALID_DEVICE_UUID).value;
}

function makeDomainState(overrides: Partial<DeviceStateProps> = {}): DeviceState {
  const deviceId = makeDeviceId();
  const props: DeviceStateProps = {
    deviceId,
    isOnline:            true,
    lastSeen:            FIXED_DATE,
    lastLatencyMs:       20,
    consecutiveFailures: 0,
    lastCheckedAt:       FIXED_DATE,
    updatedAt:           FIXED_DATE,
    ...overrides
  };
  return DeviceState.reconstitute(deviceId, props);
}

// ---------------------------------------------------------------------------

describe('DeviceStateMapper', () => {

  // ===========================================================================
  describe('toDomain()', () => {
    describe('happy path — field mapping', () => {
      it('should return a DeviceState instance', () => {
        const state = DeviceStateMapper.toDomain(makeRawRow());

        expect(state).toBeInstanceOf(DeviceState);
      });

      it('should map deviceId to a DeviceId instance with the correct UUID', () => {
        const state = DeviceStateMapper.toDomain(makeRawRow());

        expect(state.deviceId.toString()).toBe(VALID_DEVICE_UUID);
      });

      it('should map isOnline to true', () => {
        const state = DeviceStateMapper.toDomain(makeRawRow({ isOnline: true }));

        expect(state.isOnline).toBe(true);
      });

      it('should map isOnline to false', () => {
        const state = DeviceStateMapper.toDomain(makeRawRow({ isOnline: false }));

        expect(state.isOnline).toBe(false);
      });

      it('should map lastSeen when a date is provided', () => {
        const state = DeviceStateMapper.toDomain(makeRawRow({ lastSeen: FIXED_DATE }));

        expect(state.lastSeen).toEqual(FIXED_DATE);
      });

      it('should map lastSeen as null when null in the row', () => {
        const state = DeviceStateMapper.toDomain(makeRawRow({ lastSeen: null }));

        expect(state.lastSeen).toBeNull();
      });

      it('should map lastCheckedAt when a date is provided', () => {
        const state = DeviceStateMapper.toDomain(makeRawRow({ lastCheckedAt: LATER_DATE }));

        expect(state.lastCheckedAt).toEqual(LATER_DATE);
      });

      it('should map lastCheckedAt as null when null in the row', () => {
        const state = DeviceStateMapper.toDomain(makeRawRow({ lastCheckedAt: null }));

        expect(state.lastCheckedAt).toBeNull();
      });

      it('should map consecutiveFailures correctly', () => {
        const state = DeviceStateMapper.toDomain(makeRawRow({ consecutiveFailures: 7 }));

        expect(state.consecutiveFailures).toBe(7);
      });
    });

    describe('lastLatencyMs coercion', () => {
      it('should coerce a plain number to a JS number', () => {
        const state = DeviceStateMapper.toDomain(makeRawRow({ lastLatencyMs: 42 }));

        expect(state.lastLatencyMs).toBe(42);
      });

      it('should coerce a Decimal-like object (with valueOf) to a number', () => {
        // Prisma Decimal objects implement valueOf(), so Number() correctly converts them
        const decimalLike = { valueOf: () => 33.5, toString: () => '33.5' };
        const state = DeviceStateMapper.toDomain(makeRawRow({ lastLatencyMs: decimalLike }));

        expect(state.lastLatencyMs).toBe(33.5);
      });

      it('should coerce a numeric string to a number', () => {
        const state = DeviceStateMapper.toDomain(makeRawRow({ lastLatencyMs: '15' }));

        expect(state.lastLatencyMs).toBe(15);
      });

      it('should map null lastLatencyMs as null without coercion', () => {
        const state = DeviceStateMapper.toDomain(makeRawRow({ lastLatencyMs: null }));

        expect(state.lastLatencyMs).toBeNull();
      });
    });

    describe('data integrity violations', () => {
      it('should throw when deviceId is not a valid UUID', () => {
        const raw = makeRawRow({ deviceId: 'not-a-uuid' });

        expect(() => DeviceStateMapper.toDomain(raw)).toThrow();
      });

      it('should throw with a message referencing "Data integrity violation"', () => {
        const raw = makeRawRow({ deviceId: 'bad-device-id' });

        expect(() => DeviceStateMapper.toDomain(raw)).toThrow(
          'Data integrity violation'
        );
      });

      it('should include the invalid deviceId value in the error message', () => {
        const raw = makeRawRow({ deviceId: 'clearly-invalid' });

        expect(() => DeviceStateMapper.toDomain(raw)).toThrow(
          'clearly-invalid'
        );
      });
    });
  });

  // ===========================================================================
  describe('toPersistence()', () => {
    describe('happy path — field serialization', () => {
      it('should serialize deviceId as a plain string', () => {
        const state = makeDomainState();

        const raw = DeviceStateMapper.toPersistence(state);

        expect(raw.deviceId).toBe(VALID_DEVICE_UUID);
      });

      it('should serialize isOnline as true', () => {
        const state = makeDomainState({ isOnline: true });

        const raw = DeviceStateMapper.toPersistence(state);

        expect(raw.isOnline).toBe(true);
      });

      it('should serialize isOnline as false', () => {
        const state = makeDomainState({ isOnline: false });

        const raw = DeviceStateMapper.toPersistence(state);

        expect(raw.isOnline).toBe(false);
      });

      it('should serialize lastSeen when set', () => {
        const state = makeDomainState({ lastSeen: FIXED_DATE });

        const raw = DeviceStateMapper.toPersistence(state);

        expect(raw.lastSeen).toEqual(FIXED_DATE);
      });

      it('should serialize null lastSeen as null', () => {
        const state = makeDomainState({ lastSeen: null });

        const raw = DeviceStateMapper.toPersistence(state);

        expect(raw.lastSeen).toBeNull();
      });

      it('should serialize lastLatencyMs when set', () => {
        const state = makeDomainState({ lastLatencyMs: 99 });

        const raw = DeviceStateMapper.toPersistence(state);

        expect(raw.lastLatencyMs).toBe(99);
      });

      it('should serialize null lastLatencyMs as null', () => {
        const state = makeDomainState({ lastLatencyMs: null });

        const raw = DeviceStateMapper.toPersistence(state);

        expect(raw.lastLatencyMs).toBeNull();
      });

      it('should serialize consecutiveFailures correctly', () => {
        const state = makeDomainState({ consecutiveFailures: 4 });

        const raw = DeviceStateMapper.toPersistence(state);

        expect(raw.consecutiveFailures).toBe(4);
      });

      it('should serialize lastCheckedAt when set', () => {
        const state = makeDomainState({ lastCheckedAt: LATER_DATE });

        const raw = DeviceStateMapper.toPersistence(state);

        expect(raw.lastCheckedAt).toEqual(LATER_DATE);
      });

      it('should serialize null lastCheckedAt as null', () => {
        const state = makeDomainState({ lastCheckedAt: null });

        const raw = DeviceStateMapper.toPersistence(state);

        expect(raw.lastCheckedAt).toBeNull();
      });
    });
  });

  // ===========================================================================
  describe('round-trip — toDomain → toPersistence', () => {
    it('should preserve deviceId through a round-trip', () => {
      const raw         = makeRawRow();
      const state       = DeviceStateMapper.toDomain(raw);
      const serialized  = DeviceStateMapper.toPersistence(state);

      expect(serialized.deviceId).toBe(VALID_DEVICE_UUID);
    });

    it('should preserve isOnline through a round-trip', () => {
      const raw         = makeRawRow({ isOnline: false });
      const state       = DeviceStateMapper.toDomain(raw);
      const serialized  = DeviceStateMapper.toPersistence(state);

      expect(serialized.isOnline).toBe(false);
    });

    it('should preserve lastSeen through a round-trip', () => {
      const raw         = makeRawRow({ lastSeen: FIXED_DATE });
      const state       = DeviceStateMapper.toDomain(raw);
      const serialized  = DeviceStateMapper.toPersistence(state);

      expect(serialized.lastSeen).toEqual(FIXED_DATE);
    });

    it('should preserve null lastSeen through a round-trip', () => {
      const raw         = makeRawRow({ lastSeen: null });
      const state       = DeviceStateMapper.toDomain(raw);
      const serialized  = DeviceStateMapper.toPersistence(state);

      expect(serialized.lastSeen).toBeNull();
    });

    it('should preserve lastLatencyMs through a round-trip', () => {
      const raw         = makeRawRow({ lastLatencyMs: 77 });
      const state       = DeviceStateMapper.toDomain(raw);
      const serialized  = DeviceStateMapper.toPersistence(state);

      expect(serialized.lastLatencyMs).toBe(77);
    });

    it('should preserve consecutiveFailures through a round-trip', () => {
      const raw         = makeRawRow({ consecutiveFailures: 5 });
      const state       = DeviceStateMapper.toDomain(raw);
      const serialized  = DeviceStateMapper.toPersistence(state);

      expect(serialized.consecutiveFailures).toBe(5);
    });
  });
});
