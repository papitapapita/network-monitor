// Source: src/infrastructure/mappers/PollingConfigurationMapper.ts

import { PollingConfigurationMapper } from '../../../src/infrastructure/mappers/PollingConfigurationMapper';
import { PollingConfiguration } from '../../../src/domain/device-monitoring/entities/PollingConfiguration';
import { PollingConfigurationId } from '../../../src/domain/shared/ids/PollingConfigurationId';
import { DeviceId } from '../../../src/domain/shared/ids/DeviceId';
import { IPAddress } from '../../../src/domain/shared/value-objects/IPAddress';
import { PollingInterval } from '../../../src/domain/device-monitoring/value-objects/PollingInterval';
import { FailureThreshold } from '../../../src/domain/device-monitoring/value-objects/FailureThreshold';

// ---------------------------------------------------------------------------
// Constants & Fixtures
// ---------------------------------------------------------------------------

const VALID_ID = '550e8400-e29b-41d4-a716-446655440000';
const VALID_DEVICE_ID = '550e8400-e29b-41d4-a716-446655440001';
const TEST_IP = '192.168.10.5';

type RawRecord = {
  id: string;
  deviceId: string;
  ipAddress: string | null;
  enabled: boolean;
  pingIntervalSecs: number;
  failuresBeforeDown: number;
  lastPolledAt: Date | null;
};

function makeRawRecord(
  overrides: Partial<RawRecord> = {}
): RawRecord {
  return {
    id: VALID_ID,
    deviceId: VALID_DEVICE_ID,
    ipAddress: TEST_IP,
    enabled: true,
    pingIntervalSecs: 60,
    failuresBeforeDown: 3,
    lastPolledAt: null,
    ...overrides
  };
}

function makeEntity(
  overrides: {
    ipAddress?: string | null;
    enabled?: boolean;
    intervalSeconds?: number;
    thresholdCount?: number;
  } = {}
): PollingConfiguration {
  const rawIp =
    overrides.ipAddress !== undefined ? overrides.ipAddress : TEST_IP;
  return PollingConfiguration.reconstitute(
    PollingConfigurationId.parse(VALID_ID).value,
    {
      deviceId: DeviceId.parse(VALID_DEVICE_ID).value,
      ipAddress:
        rawIp !== null ? IPAddress.reconstitute(rawIp) : null,
      interval: PollingInterval.reconstitute({
        seconds: overrides.intervalSeconds ?? 60
      }),
      failuresBeforeDown: FailureThreshold.reconstitute({
        count: overrides.thresholdCount ?? 3
      }),
      enabled:
        overrides.enabled !== undefined ? overrides.enabled : true
    }
  );
}

// ---------------------------------------------------------------------------

describe('PollingConfigurationMapper', () => {
  // ===========================================================================
  describe('toDomain()', () => {
    describe('happy path', () => {
      it('should return a PollingConfiguration instance', () => {
        const raw = makeRawRecord();

        const entity = PollingConfigurationMapper.toDomain(raw);

        expect(entity).toBeInstanceOf(PollingConfiguration);
      });

      it('should map the id correctly', () => {
        const raw = makeRawRecord();

        const entity = PollingConfigurationMapper.toDomain(raw);

        expect(entity.id.toString()).toBe(VALID_ID);
      });

      it('should map the deviceId correctly', () => {
        const raw = makeRawRecord();

        const entity = PollingConfigurationMapper.toDomain(raw);

        expect(entity.deviceId.toString()).toBe(VALID_DEVICE_ID);
      });

      it('should map ipAddress correctly when present', () => {
        const raw = makeRawRecord({ ipAddress: TEST_IP });

        const entity = PollingConfigurationMapper.toDomain(raw);

        expect(entity.ipAddress?.value).toBe(TEST_IP);
      });

      it('should map ipAddress as null when null in the record', () => {
        const raw = makeRawRecord({ ipAddress: null });

        const entity = PollingConfigurationMapper.toDomain(raw);

        expect(entity.ipAddress).toBeNull();
      });

      it('should map enabled to true', () => {
        const raw = makeRawRecord({ enabled: true });

        const entity = PollingConfigurationMapper.toDomain(raw);

        expect(entity.enabled).toBe(true);
      });

      it('should map enabled to false', () => {
        const raw = makeRawRecord({ enabled: false });

        const entity = PollingConfigurationMapper.toDomain(raw);

        expect(entity.enabled).toBe(false);
      });

      it('should map pingIntervalSecs to interval.seconds', () => {
        const raw = makeRawRecord({ pingIntervalSecs: 300 });

        const entity = PollingConfigurationMapper.toDomain(raw);

        expect(entity.interval.seconds).toBe(300);
      });

      it('should map failuresBeforeDown to failuresBeforeDown.value', () => {
        const raw = makeRawRecord({ failuresBeforeDown: 5 });

        const entity = PollingConfigurationMapper.toDomain(raw);

        expect(entity.failuresBeforeDown.value).toBe(5);
      });

      it('should map the minimum pingIntervalSecs of 1', () => {
        const raw = makeRawRecord({ pingIntervalSecs: 1 });

        const entity = PollingConfigurationMapper.toDomain(raw);

        expect(entity.interval.seconds).toBe(1);
      });

      it('should map the maximum pingIntervalSecs of 86400', () => {
        const raw = makeRawRecord({ pingIntervalSecs: 86400 });

        const entity = PollingConfigurationMapper.toDomain(raw);

        expect(entity.interval.seconds).toBe(86400);
      });
    });

    describe('data integrity violations', () => {
      it('should throw when deviceId is not a valid UUID', () => {
        const raw = makeRawRecord({ deviceId: 'not-a-uuid' });

        expect(() =>
          PollingConfigurationMapper.toDomain(raw)
        ).toThrow('Data integrity violation');
      });

      it('should throw with the invalid deviceId in the error message', () => {
        const raw = makeRawRecord({ deviceId: 'bad-device-id' });

        expect(() =>
          PollingConfigurationMapper.toDomain(raw)
        ).toThrow('bad-device-id');
      });

      it('should throw when id is not a valid UUID', () => {
        const raw = makeRawRecord({ id: 'not-a-uuid' });

        expect(() =>
          PollingConfigurationMapper.toDomain(raw)
        ).toThrow('Data integrity violation');
      });

      it('should throw with the invalid id in the error message', () => {
        const raw = makeRawRecord({ id: 'bad-config-id' });

        expect(() =>
          PollingConfigurationMapper.toDomain(raw)
        ).toThrow('bad-config-id');
      });

      it('should throw when both id and deviceId are invalid', () => {
        const raw = makeRawRecord({
          id: 'bad',
          deviceId: 'also-bad'
        });

        expect(() =>
          PollingConfigurationMapper.toDomain(raw)
        ).toThrow();
      });
    });
  });

  // ===========================================================================
  describe('toPersistence()', () => {
    describe('happy path', () => {
      it('should serialize id as a string', () => {
        const entity = makeEntity();

        const raw = PollingConfigurationMapper.toPersistence(entity);

        expect(raw.id).toBe(VALID_ID);
      });

      it('should serialize deviceId as a string', () => {
        const entity = makeEntity();

        const raw = PollingConfigurationMapper.toPersistence(entity);

        expect(raw.deviceId).toBe(VALID_DEVICE_ID);
      });

      it('should serialize ipAddress when present', () => {
        const entity = makeEntity({ ipAddress: TEST_IP });

        const raw = PollingConfigurationMapper.toPersistence(entity);

        expect(raw.ipAddress).toBe(TEST_IP);
      });

      it('should serialize ipAddress as null when not set', () => {
        const entity = makeEntity({ ipAddress: null });

        const raw = PollingConfigurationMapper.toPersistence(entity);

        expect(raw.ipAddress).toBeNull();
      });

      it('should serialize enabled as true', () => {
        const entity = makeEntity({ enabled: true });

        const raw = PollingConfigurationMapper.toPersistence(entity);

        expect(raw.enabled).toBe(true);
      });

      it('should serialize enabled as false', () => {
        const entity = makeEntity({ enabled: false });

        const raw = PollingConfigurationMapper.toPersistence(entity);

        expect(raw.enabled).toBe(false);
      });

      it('should serialize interval.seconds to pingIntervalSecs', () => {
        const entity = makeEntity({ intervalSeconds: 300 });

        const raw = PollingConfigurationMapper.toPersistence(entity);

        expect(raw.pingIntervalSecs).toBe(300);
      });

      it('should serialize failuresBeforeDown.value to failuresBeforeDown', () => {
        const entity = makeEntity({ thresholdCount: 7 });

        const raw = PollingConfigurationMapper.toPersistence(entity);

        expect(raw.failuresBeforeDown).toBe(7);
      });
    });
  });

  // ===========================================================================
  describe('round-trip — toDomain → toPersistence', () => {
    it('should reproduce the same id and deviceId after a round-trip', () => {
      const raw = makeRawRecord();

      const entity = PollingConfigurationMapper.toDomain(raw);
      const serialized =
        PollingConfigurationMapper.toPersistence(entity);

      expect(serialized.id).toBe(raw.id);
      expect(serialized.deviceId).toBe(raw.deviceId);
    });

    it('should preserve ipAddress through a round-trip', () => {
      const raw = makeRawRecord({ ipAddress: '172.16.0.1' });

      const entity = PollingConfigurationMapper.toDomain(raw);
      const serialized =
        PollingConfigurationMapper.toPersistence(entity);

      expect(serialized.ipAddress).toBe('172.16.0.1');
    });

    it('should preserve null ipAddress through a round-trip', () => {
      const raw = makeRawRecord({ ipAddress: null });

      const entity = PollingConfigurationMapper.toDomain(raw);
      const serialized =
        PollingConfigurationMapper.toPersistence(entity);

      expect(serialized.ipAddress).toBeNull();
    });

    it('should preserve enabled flag through a round-trip', () => {
      const raw = makeRawRecord({ enabled: false });

      const entity = PollingConfigurationMapper.toDomain(raw);
      const serialized =
        PollingConfigurationMapper.toPersistence(entity);

      expect(serialized.enabled).toBe(false);
    });

    it('should preserve pingIntervalSecs through a round-trip', () => {
      const raw = makeRawRecord({ pingIntervalSecs: 3600 });

      const entity = PollingConfigurationMapper.toDomain(raw);
      const serialized =
        PollingConfigurationMapper.toPersistence(entity);

      expect(serialized.pingIntervalSecs).toBe(3600);
    });

    it('should preserve failuresBeforeDown through a round-trip', () => {
      const raw = makeRawRecord({ failuresBeforeDown: 10 });

      const entity = PollingConfigurationMapper.toDomain(raw);
      const serialized =
        PollingConfigurationMapper.toPersistence(entity);

      expect(serialized.failuresBeforeDown).toBe(10);
    });
  });

  // ===========================================================================
  describe('round-trip — toPersistence → toDomain', () => {
    it('should recover the same domain entity from its serialized form', () => {
      const original = makeEntity({
        ipAddress: '10.10.10.1',
        enabled: false,
        intervalSeconds: 120,
        thresholdCount: 5
      });

      const raw = PollingConfigurationMapper.toPersistence(original);
      const recovered = PollingConfigurationMapper.toDomain(raw);

      expect(recovered.id.toString()).toBe(original.id.toString());
      expect(recovered.deviceId.toString()).toBe(
        original.deviceId.toString()
      );
      expect(recovered.ipAddress?.value).toBe(
        original.ipAddress?.value
      );
      expect(recovered.enabled).toBe(original.enabled);
      expect(recovered.interval.seconds).toBe(
        original.interval.seconds
      );
      expect(recovered.failuresBeforeDown.value).toBe(
        original.failuresBeforeDown.value
      );
    });
  });
});
