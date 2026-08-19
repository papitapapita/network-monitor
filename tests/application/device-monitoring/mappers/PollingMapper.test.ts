// Source: src/application/device-monitoring/mappers/PollingMapper.ts

import { PollingMapper } from 'application/device-monitoring/mappers/PollingMapper';
import { PollingConfiguration } from 'domain/device-monitoring/entities/PollingConfiguration';
import { DeviceState } from 'domain/device-monitoring/aggregates/DeviceState';
import { PingResultRecord } from 'domain/device-monitoring/repository/IPingResultRepository';
import { DeviceId } from 'domain/shared/ids/DeviceId';
import { PollingConfigurationId } from 'domain/shared/ids/PollingConfigurationId';
import { PollingInterval } from 'domain/device-monitoring/value-objects/PollingInterval';
import { FailureThreshold } from 'domain/device-monitoring/value-objects/FailureThreshold';
import { ReachabilityStatus } from 'domain/device-monitoring/value-objects/ReachabilityStatus';
import { IPAddress } from 'domain/shared/value-objects/IPAddress';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEVICE_UUID = '550e8400-e29b-41d4-a716-446655440001';
const CONFIG_UUID = '550e8400-e29b-41d4-a716-446655440002';
const PING_RECORD_ID = '550e8400-e29b-41d4-a716-446655440003';
const TEST_IP = '192.168.1.10';
const FIXED_LAST_CHECKED = new Date('2024-06-01T10:00:00.000Z');
const FIXED_PING_CHECKED_AT = new Date('2024-06-01T09:59:30.000Z');
const FIXED_TIMESTAMP = new Date('2024-06-01T11:00:00.000Z');

// ---------------------------------------------------------------------------
// Domain object factories
// ---------------------------------------------------------------------------

function makeDeviceId(): DeviceId {
  const result = DeviceId.parse(DEVICE_UUID);
  if (result.isFailure)
    throw new Error(`Test setup: ${result.error}`);
  return result.value;
}

function makePollingConfig(
  overrides: {
    enabled?: boolean;
    intervalSeconds?: number;
    failureCount?: number;
    ipAddress?: string | null;
  } = {}
): PollingConfiguration {
  const deviceId = makeDeviceId();
  const configId = PollingConfigurationId.parse(CONFIG_UUID);
  if (configId.isFailure)
    throw new Error(`Test setup: ${configId.error}`);

  const intervalSeconds = overrides.intervalSeconds ?? 60;
  const failureCount = overrides.failureCount ?? 3;

  const interval = PollingInterval.create(intervalSeconds);
  if (interval.isFailure)
    throw new Error(`Test setup: ${interval.error}`);

  const threshold = FailureThreshold.create(failureCount);
  if (threshold.isFailure)
    throw new Error(`Test setup: ${threshold.error}`);

  let ipAddress: IPAddress | null = null;
  if (overrides.ipAddress !== undefined) {
    if (overrides.ipAddress !== null) {
      const ipResult = IPAddress.create(overrides.ipAddress);
      if (ipResult.isFailure)
        throw new Error(`Test setup: ${ipResult.error}`);
      ipAddress = ipResult.value;
    }
  } else {
    const ipResult = IPAddress.create(TEST_IP);
    if (ipResult.isFailure)
      throw new Error(`Test setup: ${ipResult.error}`);
    ipAddress = ipResult.value;
  }

  return PollingConfiguration.reconstitute(configId.value, {
    deviceId,
    ipAddress,
    interval: interval.value,
    failuresBeforeDown: threshold.value,
    enabled: overrides.enabled ?? true
  });
}

function makeDeviceState(
  overrides: {
    isOnline?: boolean;
    status?: ReachabilityStatus;
    lastCheckedAt?: Date | null;
    consecutiveFailures?: number;
    lastLatencyMs?: number | null;
    lastSeen?: Date | null;
  } = {}
): DeviceState {
  const deviceId = makeDeviceId();
  return DeviceState.reconstitute(deviceId, {
    deviceId,
    status:
      overrides.status ??
      ((overrides.isOnline ?? true)
        ? ReachabilityStatus.createUp()
        : ReachabilityStatus.createDown()),
    lastSeen: overrides.lastSeen ?? FIXED_LAST_CHECKED,
    lastLatencyMs: overrides.lastLatencyMs ?? 25,
    consecutiveFailures: overrides.consecutiveFailures ?? 0,
    lastCheckedAt:
      overrides.lastCheckedAt !== undefined
        ? overrides.lastCheckedAt
        : FIXED_LAST_CHECKED,
    updatedAt: FIXED_LAST_CHECKED
  });
}

function makePingRecord(
  overrides: {
    id?: string;
    isReachable?: boolean;
    latencyMs?: number | null;
    checkedAt?: Date;
  } = {}
): PingResultRecord {
  return {
    id: overrides.id ?? PING_RECORD_ID,
    deviceId: makeDeviceId(),
    isReachable: overrides.isReachable ?? true,
    latencyMs:
      overrides.latencyMs !== undefined ? overrides.latencyMs : 42,
    checkedAt: overrides.checkedAt ?? FIXED_PING_CHECKED_AT
  };
}

// ---------------------------------------------------------------------------

describe('PollingMapper', () => {
  // ==========================================================================
  describe('toStatusDTO()', () => {
    // ------------------------------------------------------------------------
    describe('when state and lastPing are both present and device is online', () => {
      it('should map deviceId as the string representation of config.deviceId', () => {
        const config = makePollingConfig();
        const state = makeDeviceState({ isOnline: true });
        const ping = makePingRecord({ isReachable: true });

        const dto = PollingMapper.toStatusDTO(config, state, ping);

        expect(dto.deviceId).toBe(DEVICE_UUID);
      });

      it('should map pollingEnabled from config.enabled', () => {
        const config = makePollingConfig({ enabled: true });
        const state = makeDeviceState();
        const ping = makePingRecord();

        const dto = PollingMapper.toStatusDTO(config, state, ping);

        expect(dto.pollingEnabled).toBe(true);
      });

      it('should map pollingEnabled as false when config is disabled', () => {
        const config = makePollingConfig({ enabled: false });
        const state = makeDeviceState();
        const ping = makePingRecord();

        const dto = PollingMapper.toStatusDTO(config, state, ping);

        expect(dto.pollingEnabled).toBe(false);
      });

      it('should map intervalSeconds from config.interval.seconds', () => {
        const config = makePollingConfig({ intervalSeconds: 120 });
        const state = makeDeviceState();
        const ping = makePingRecord();

        const dto = PollingMapper.toStatusDTO(config, state, ping);

        expect(dto.intervalSeconds).toBe(120);
      });

      it('should map failuresBeforeDown from config.failuresBeforeDown.value', () => {
        const config = makePollingConfig({ failureCount: 5 });
        const state = makeDeviceState();
        const ping = makePingRecord();

        const dto = PollingMapper.toStatusDTO(config, state, ping);

        expect(dto.failuresBeforeDown).toBe(5);
      });

      it('should set lastPolled to state.lastCheckedAt', () => {
        const config = makePollingConfig();
        const state = makeDeviceState({
          lastCheckedAt: FIXED_LAST_CHECKED
        });
        const ping = makePingRecord();

        const dto = PollingMapper.toStatusDTO(config, state, ping);

        expect(dto.lastPolled).toEqual(FIXED_LAST_CHECKED);
      });

      it('should calculate nextScheduled as lastCheckedAt plus intervalSeconds in milliseconds', () => {
        const intervalSeconds = 60;
        const config = makePollingConfig({ intervalSeconds });
        const state = makeDeviceState({
          lastCheckedAt: FIXED_LAST_CHECKED
        });
        const ping = makePingRecord();

        const dto = PollingMapper.toStatusDTO(config, state, ping);

        const expected = new Date(
          FIXED_LAST_CHECKED.getTime() + intervalSeconds * 1000
        );
        expect(dto.nextScheduled).toEqual(expected);
      });

      it('should set currentStatus to ONLINE when state.isOnline is true', () => {
        const config = makePollingConfig();
        const state = makeDeviceState({ isOnline: true });
        const ping = makePingRecord();

        const dto = PollingMapper.toStatusDTO(config, state, ping);

        expect(dto.currentStatus).toBe('ONLINE');
      });

      it('should set currentStatus to OFFLINE when state.isOnline is false', () => {
        const config = makePollingConfig();
        const state = makeDeviceState({ isOnline: false });
        const ping = makePingRecord();

        const dto = PollingMapper.toStatusDTO(config, state, ping);

        expect(dto.currentStatus).toBe('OFFLINE');
      });

      it('[MON-002] should set currentStatus to UNKNOWN for a stored UNKNOWN status, not just a missing row', () => {
        const config = makePollingConfig();
        const state = makeDeviceState({
          status: ReachabilityStatus.createUnknown()
        });
        const ping = makePingRecord();

        const dto = PollingMapper.toStatusDTO(config, state, ping);

        expect(dto.currentStatus).toBe('UNKNOWN');
      });

      it('[MON-002] should report UNKNOWN rather than OFFLINE for a paused device that was down', () => {
        const config = makePollingConfig();
        const state = makeDeviceState({ isOnline: false });
        state.markUnknown(FIXED_LAST_CHECKED);
        const ping = makePingRecord();

        const dto = PollingMapper.toStatusDTO(config, state, ping);

        expect(dto.currentStatus).toBe('UNKNOWN');
      });

      it('should set consecutiveFailures from state.consecutiveFailures', () => {
        const config = makePollingConfig();
        const state = makeDeviceState({ consecutiveFailures: 2 });
        const ping = makePingRecord();

        const dto = PollingMapper.toStatusDTO(config, state, ping);

        expect(dto.consecutiveFailures).toBe(2);
      });

      it('should populate lastResult from lastPing when lastPing is provided', () => {
        const config = makePollingConfig();
        const state = makeDeviceState({ isOnline: true });
        const ping = makePingRecord({
          id: PING_RECORD_ID,
          isReachable: true,
          latencyMs: 42,
          checkedAt: FIXED_PING_CHECKED_AT
        });

        const dto = PollingMapper.toStatusDTO(config, state, ping);

        expect(dto.lastResult).not.toBeNull();
        expect(dto.lastResult?.id).toBe(PING_RECORD_ID);
        expect(dto.lastResult?.deviceId).toBe(DEVICE_UUID);
        expect(dto.lastResult?.timestamp).toEqual(
          FIXED_PING_CHECKED_AT
        );
        expect(dto.lastResult?.status).toBe('SUCCESS');
        expect(dto.lastResult?.metrics).toEqual({ latencyMs: 42 });
        expect(dto.lastResult?.deviceStatus).toBe('ONLINE');
      });

      it('should derive lastResult.deviceStatus from state when state is present', () => {
        const config = makePollingConfig();
        const state = makeDeviceState({ isOnline: false });
        const ping = makePingRecord({
          isReachable: true,
          latencyMs: 10
        });

        const dto = PollingMapper.toStatusDTO(config, state, ping);

        // State takes precedence over ping reachability for deviceStatus
        expect(dto.lastResult?.deviceStatus).toBe('OFFLINE');
      });
    });

    // ------------------------------------------------------------------------
    describe('when state is null', () => {
      it('should set lastPolled to null', () => {
        const config = makePollingConfig();
        const ping = makePingRecord();

        const dto = PollingMapper.toStatusDTO(config, null, ping);

        expect(dto.lastPolled).toBeNull();
      });

      it('should set nextScheduled to null', () => {
        const config = makePollingConfig();
        const ping = makePingRecord();

        const dto = PollingMapper.toStatusDTO(config, null, ping);

        expect(dto.nextScheduled).toBeNull();
      });

      it('should set currentStatus to UNKNOWN', () => {
        const config = makePollingConfig();
        const ping = makePingRecord();

        const dto = PollingMapper.toStatusDTO(config, null, ping);

        expect(dto.currentStatus).toBe('UNKNOWN');
      });

      it('should set consecutiveFailures to 0', () => {
        const config = makePollingConfig();
        const ping = makePingRecord();

        const dto = PollingMapper.toStatusDTO(config, null, ping);

        expect(dto.consecutiveFailures).toBe(0);
      });

      it('should still populate lastResult from lastPing when state is null', () => {
        const config = makePollingConfig();
        const ping = makePingRecord({
          isReachable: true,
          latencyMs: 55
        });

        const dto = PollingMapper.toStatusDTO(config, null, ping);

        expect(dto.lastResult).not.toBeNull();
        expect(dto.lastResult?.status).toBe('SUCCESS');
      });

      it('should derive lastResult.deviceStatus from ping reachability when state is null', () => {
        const config = makePollingConfig();
        const ping = makePingRecord({ isReachable: true });

        const dto = PollingMapper.toStatusDTO(config, null, ping);

        expect(dto.lastResult?.deviceStatus).toBe('ONLINE');
      });

      it('should set lastResult.deviceStatus to OFFLINE from ping when isReachable is false and state is null', () => {
        const config = makePollingConfig();
        const ping = makePingRecord({
          isReachable: false,
          latencyMs: null
        });

        const dto = PollingMapper.toStatusDTO(config, null, ping);

        expect(dto.lastResult?.deviceStatus).toBe('OFFLINE');
      });
    });

    // ------------------------------------------------------------------------
    describe('when lastPing is null', () => {
      it('should set lastResult to null', () => {
        const config = makePollingConfig();
        const state = makeDeviceState();

        const dto = PollingMapper.toStatusDTO(config, state, null);

        expect(dto.lastResult).toBeNull();
      });

      it('should still derive currentStatus from state when lastPing is null', () => {
        const config = makePollingConfig();
        const state = makeDeviceState({ isOnline: true });

        const dto = PollingMapper.toStatusDTO(config, state, null);

        expect(dto.currentStatus).toBe('ONLINE');
      });
    });

    // ------------------------------------------------------------------------
    describe('when both state and lastPing are null', () => {
      it('should produce a fully null/zero/UNKNOWN DTO', () => {
        const config = makePollingConfig({
          intervalSeconds: 30,
          failureCount: 2,
          enabled: false
        });

        const dto = PollingMapper.toStatusDTO(config, null, null);

        expect(dto.deviceId).toBe(DEVICE_UUID);
        expect(dto.pollingEnabled).toBe(false);
        expect(dto.intervalSeconds).toBe(30);
        expect(dto.failuresBeforeDown).toBe(2);
        expect(dto.lastPolled).toBeNull();
        expect(dto.nextScheduled).toBeNull();
        expect(dto.currentStatus).toBe('UNKNOWN');
        expect(dto.lastResult).toBeNull();
        expect(dto.consecutiveFailures).toBe(0);
      });
    });

    // ------------------------------------------------------------------------
    describe('when state.lastCheckedAt is null', () => {
      it('should set lastPolled to null', () => {
        const config = makePollingConfig();
        const state = makeDeviceState({ lastCheckedAt: null });
        const ping = makePingRecord();

        const dto = PollingMapper.toStatusDTO(config, state, ping);

        expect(dto.lastPolled).toBeNull();
      });

      it('should set nextScheduled to null when lastCheckedAt is null', () => {
        const config = makePollingConfig();
        const state = makeDeviceState({ lastCheckedAt: null });
        const ping = makePingRecord();

        const dto = PollingMapper.toStatusDTO(config, state, ping);

        expect(dto.nextScheduled).toBeNull();
      });
    });

    // ------------------------------------------------------------------------
    describe('lastResult when lastPing is not reachable', () => {
      it('should set lastResult.status to FAILED for an unreachable ping', () => {
        const config = makePollingConfig();
        const state = makeDeviceState({ isOnline: false });
        const ping = makePingRecord({
          isReachable: false,
          latencyMs: null
        });

        const dto = PollingMapper.toStatusDTO(config, state, ping);

        expect(dto.lastResult?.status).toBe('FAILED');
      });

      it('should set lastResult.metrics to null for an unreachable ping', () => {
        const config = makePollingConfig();
        const state = makeDeviceState({ isOnline: false });
        const ping = makePingRecord({
          isReachable: false,
          latencyMs: null
        });

        const dto = PollingMapper.toStatusDTO(config, state, ping);

        expect(dto.lastResult?.metrics).toBeNull();
      });
    });
  });

  // ==========================================================================
  describe('toSkippedResultDTO()', () => {
    // ------------------------------------------------------------------------
    describe('happy path', () => {
      it('should map deviceId to the provided string', () => {
        const dto = PollingMapper.toSkippedResultDTO(
          DEVICE_UUID,
          FIXED_TIMESTAMP
        );

        expect(dto.deviceId).toBe(DEVICE_UUID);
      });

      it('should set status to SKIPPED', () => {
        const dto = PollingMapper.toSkippedResultDTO(
          DEVICE_UUID,
          FIXED_TIMESTAMP
        );

        expect(dto.status).toBe('SKIPPED');
      });

      it('should set a non-empty message', () => {
        const dto = PollingMapper.toSkippedResultDTO(
          DEVICE_UUID,
          FIXED_TIMESTAMP
        );

        expect(typeof dto.message).toBe('string');
        expect(dto.message.length).toBeGreaterThan(0);
      });

      it('should set message to the canonical disabled-polling sentence', () => {
        const dto = PollingMapper.toSkippedResultDTO(
          DEVICE_UUID,
          FIXED_TIMESTAMP
        );

        expect(dto.message).toBe(
          'Polling is disabled for this device'
        );
      });

      it('should preserve the provided timestamp', () => {
        const dto = PollingMapper.toSkippedResultDTO(
          DEVICE_UUID,
          FIXED_TIMESTAMP
        );

        expect(dto.timestamp).toEqual(FIXED_TIMESTAMP);
      });

      it('should set metrics to null', () => {
        const dto = PollingMapper.toSkippedResultDTO(
          DEVICE_UUID,
          FIXED_TIMESTAMP
        );

        expect(dto.metrics).toBeNull();
      });

      it('should set deviceStatus to UNKNOWN', () => {
        const dto = PollingMapper.toSkippedResultDTO(
          DEVICE_UUID,
          FIXED_TIMESTAMP
        );

        expect(dto.deviceStatus).toBe('UNKNOWN');
      });

      it('should produce the same output given the same inputs (pure transformation)', () => {
        const dto1 = PollingMapper.toSkippedResultDTO(
          DEVICE_UUID,
          FIXED_TIMESTAMP
        );
        const dto2 = PollingMapper.toSkippedResultDTO(
          DEVICE_UUID,
          FIXED_TIMESTAMP
        );

        expect(dto1).toEqual(dto2);
      });
    });
  });

  // ==========================================================================
  describe('toPollResultDTO()', () => {
    // ------------------------------------------------------------------------
    describe('when the device is reachable', () => {
      it('should set status to SUCCESS', () => {
        const dto = PollingMapper.toPollResultDTO({
          deviceId: DEVICE_UUID,
          isReachable: true,
          latencyMs: 30,
          isOnline: true,
          consecutiveFailures: 0,
          timestamp: FIXED_TIMESTAMP
        });

        expect(dto.status).toBe('SUCCESS');
      });

      it('should include latencyMs in the success message', () => {
        const dto = PollingMapper.toPollResultDTO({
          deviceId: DEVICE_UUID,
          isReachable: true,
          latencyMs: 30,
          isOnline: true,
          consecutiveFailures: 0,
          timestamp: FIXED_TIMESTAMP
        });

        expect(dto.message).toContain('30ms');
      });

      it('should populate metrics with the provided latencyMs', () => {
        const dto = PollingMapper.toPollResultDTO({
          deviceId: DEVICE_UUID,
          isReachable: true,
          latencyMs: 30,
          isOnline: true,
          consecutiveFailures: 0,
          timestamp: FIXED_TIMESTAMP
        });

        expect(dto.metrics).toEqual({ latencyMs: 30 });
      });

      it('should set deviceStatus to ONLINE when isOnline is true', () => {
        const dto = PollingMapper.toPollResultDTO({
          deviceId: DEVICE_UUID,
          isReachable: true,
          latencyMs: 30,
          isOnline: true,
          consecutiveFailures: 0,
          timestamp: FIXED_TIMESTAMP
        });

        expect(dto.deviceStatus).toBe('ONLINE');
      });

      it('should set deviceStatus to OFFLINE when isOnline is false even if reachable', () => {
        const dto = PollingMapper.toPollResultDTO({
          deviceId: DEVICE_UUID,
          isReachable: true,
          latencyMs: 30,
          isOnline: false,
          consecutiveFailures: 0,
          timestamp: FIXED_TIMESTAMP
        });

        expect(dto.deviceStatus).toBe('OFFLINE');
      });

      it('should set metrics to null when latencyMs is null despite isReachable being true', () => {
        const dto = PollingMapper.toPollResultDTO({
          deviceId: DEVICE_UUID,
          isReachable: true,
          latencyMs: null,
          isOnline: true,
          consecutiveFailures: 0,
          timestamp: FIXED_TIMESTAMP
        });

        expect(dto.metrics).toBeNull();
      });
    });

    // ------------------------------------------------------------------------
    describe('when the device is not reachable', () => {
      it('should set status to FAILED', () => {
        const dto = PollingMapper.toPollResultDTO({
          deviceId: DEVICE_UUID,
          isReachable: false,
          latencyMs: null,
          isOnline: false,
          consecutiveFailures: 1,
          timestamp: FIXED_TIMESTAMP
        });

        expect(dto.status).toBe('FAILED');
      });

      it('should include the consecutive failure count in the failure message', () => {
        const dto = PollingMapper.toPollResultDTO({
          deviceId: DEVICE_UUID,
          isReachable: false,
          latencyMs: null,
          isOnline: false,
          consecutiveFailures: 3,
          timestamp: FIXED_TIMESTAMP
        });

        expect(dto.message).toContain('3');
      });

      it('should set metrics to null', () => {
        const dto = PollingMapper.toPollResultDTO({
          deviceId: DEVICE_UUID,
          isReachable: false,
          latencyMs: null,
          isOnline: false,
          consecutiveFailures: 1,
          timestamp: FIXED_TIMESTAMP
        });

        expect(dto.metrics).toBeNull();
      });

      it('should set deviceStatus to OFFLINE when isOnline is false', () => {
        const dto = PollingMapper.toPollResultDTO({
          deviceId: DEVICE_UUID,
          isReachable: false,
          latencyMs: null,
          isOnline: false,
          consecutiveFailures: 1,
          timestamp: FIXED_TIMESTAMP
        });

        expect(dto.deviceStatus).toBe('OFFLINE');
      });
    });

    // ------------------------------------------------------------------------
    describe('common fields', () => {
      it('should map deviceId to the provided string', () => {
        const dto = PollingMapper.toPollResultDTO({
          deviceId: DEVICE_UUID,
          isReachable: true,
          latencyMs: 10,
          isOnline: true,
          consecutiveFailures: 0,
          timestamp: FIXED_TIMESTAMP
        });

        expect(dto.deviceId).toBe(DEVICE_UUID);
      });

      it('should preserve the provided timestamp', () => {
        const dto = PollingMapper.toPollResultDTO({
          deviceId: DEVICE_UUID,
          isReachable: true,
          latencyMs: 10,
          isOnline: true,
          consecutiveFailures: 0,
          timestamp: FIXED_TIMESTAMP
        });

        expect(dto.timestamp).toEqual(FIXED_TIMESTAMP);
      });

      it('should produce identical output for identical inputs (pure transformation)', () => {
        const params = {
          deviceId: DEVICE_UUID,
          isReachable: true,
          latencyMs: 15,
          isOnline: true,
          consecutiveFailures: 0,
          timestamp: FIXED_TIMESTAMP
        };

        expect(PollingMapper.toPollResultDTO(params)).toEqual(
          PollingMapper.toPollResultDTO(params)
        );
      });
    });
  });

  // ==========================================================================
  describe('toHistoryDTO()', () => {
    // ------------------------------------------------------------------------
    describe('happy path — page with mixed reachable and unreachable records', () => {
      it('should map deviceId to the provided string', () => {
        const page = [
          makePingRecord({ isReachable: true, latencyMs: 50 })
        ];

        const dto = PollingMapper.toHistoryDTO(page, DEVICE_UUID, 1);

        expect(dto.deviceId).toBe(DEVICE_UUID);
      });

      it('should map totalCount to the provided count', () => {
        const page = [makePingRecord()];

        const dto = PollingMapper.toHistoryDTO(page, DEVICE_UUID, 42);

        expect(dto.totalCount).toBe(42);
      });

      it('should include a result entry for each record in the page', () => {
        const page = [
          makePingRecord({ id: 'id-1' }),
          makePingRecord({ id: 'id-2' }),
          makePingRecord({ id: 'id-3' })
        ];

        const dto = PollingMapper.toHistoryDTO(page, DEVICE_UUID, 3);

        expect(dto.results).toHaveLength(3);
      });

      it('should map each result id from the ping record', () => {
        const page = [
          makePingRecord({ id: 'rec-aaa' }),
          makePingRecord({ id: 'rec-bbb' })
        ];

        const dto = PollingMapper.toHistoryDTO(page, DEVICE_UUID, 2);

        expect(dto.results[0].id).toBe('rec-aaa');
        expect(dto.results[1].id).toBe('rec-bbb');
      });

      it('should set result.status to SUCCESS for a reachable record', () => {
        const page = [
          makePingRecord({ isReachable: true, latencyMs: 20 })
        ];

        const dto = PollingMapper.toHistoryDTO(page, DEVICE_UUID, 1);

        expect(dto.results[0].status).toBe('SUCCESS');
      });

      it('should set result.status to FAILED for an unreachable record', () => {
        const page = [
          makePingRecord({ isReachable: false, latencyMs: null })
        ];

        const dto = PollingMapper.toHistoryDTO(page, DEVICE_UUID, 1);

        expect(dto.results[0].status).toBe('FAILED');
      });

      it('should populate result.metrics for a reachable record with latency', () => {
        const page = [
          makePingRecord({ isReachable: true, latencyMs: 77 })
        ];

        const dto = PollingMapper.toHistoryDTO(page, DEVICE_UUID, 1);

        expect(dto.results[0].metrics).toEqual({ latencyMs: 77 });
      });

      it('should set result.metrics to null for an unreachable record', () => {
        const page = [
          makePingRecord({ isReachable: false, latencyMs: null })
        ];

        const dto = PollingMapper.toHistoryDTO(page, DEVICE_UUID, 1);

        expect(dto.results[0].metrics).toBeNull();
      });

      it('should derive result.deviceStatus from ping reachability (state is always null in history)', () => {
        const page = [
          makePingRecord({ isReachable: true, latencyMs: 10 }),
          makePingRecord({ isReachable: false, latencyMs: null })
        ];

        const dto = PollingMapper.toHistoryDTO(page, DEVICE_UUID, 2);

        expect(dto.results[0].deviceStatus).toBe('ONLINE');
        expect(dto.results[1].deviceStatus).toBe('OFFLINE');
      });
    });

    // ------------------------------------------------------------------------
    describe('statistics — successRate', () => {
      it('should compute successRate as 100 when all page records are reachable', () => {
        const page = [
          makePingRecord({ isReachable: true, latencyMs: 10 }),
          makePingRecord({ isReachable: true, latencyMs: 20 })
        ];

        const dto = PollingMapper.toHistoryDTO(page, DEVICE_UUID, 2);

        expect(dto.statistics.successRate).toBe(100);
      });

      it('should compute successRate as 0 when all page records are unreachable', () => {
        const page = [
          makePingRecord({ isReachable: false, latencyMs: null }),
          makePingRecord({ isReachable: false, latencyMs: null })
        ];

        const dto = PollingMapper.toHistoryDTO(page, DEVICE_UUID, 2);

        expect(dto.statistics.successRate).toBe(0);
      });

      it('should compute successRate based on totalCount, not page length', () => {
        // 1 success out of 4 total = 25%
        const page = [
          makePingRecord({ isReachable: true, latencyMs: 30 })
        ];

        const dto = PollingMapper.toHistoryDTO(page, DEVICE_UUID, 4);

        expect(dto.statistics.successRate).toBe(25);
      });

      it('should set successRate to 0 when totalCount is 0', () => {
        const dto = PollingMapper.toHistoryDTO([], DEVICE_UUID, 0);

        expect(dto.statistics.successRate).toBe(0);
      });

      it('should mirror successRate as uptimePercentage', () => {
        const page = [
          makePingRecord({ isReachable: true, latencyMs: 10 }),
          makePingRecord({ isReachable: false, latencyMs: null })
        ];

        const dto = PollingMapper.toHistoryDTO(page, DEVICE_UUID, 2);

        expect(dto.statistics.uptimePercentage).toBe(
          dto.statistics.successRate
        );
      });
    });

    // ------------------------------------------------------------------------
    describe('statistics — response time aggregates', () => {
      it('should compute averageResponseTime across all reachable records in the page', () => {
        const page = [
          makePingRecord({ isReachable: true, latencyMs: 100 }),
          makePingRecord({ isReachable: true, latencyMs: 200 }),
          makePingRecord({ isReachable: true, latencyMs: 300 })
        ];

        const dto = PollingMapper.toHistoryDTO(page, DEVICE_UUID, 3);

        expect(dto.statistics.averageResponseTime).toBe(200);
      });

      it('should compute minResponseTime as the lowest latency across reachable records', () => {
        const page = [
          makePingRecord({ isReachable: true, latencyMs: 50 }),
          makePingRecord({ isReachable: true, latencyMs: 10 }),
          makePingRecord({ isReachable: true, latencyMs: 30 })
        ];

        const dto = PollingMapper.toHistoryDTO(page, DEVICE_UUID, 3);

        expect(dto.statistics.minResponseTime).toBe(10);
      });

      it('should compute maxResponseTime as the highest latency across reachable records', () => {
        const page = [
          makePingRecord({ isReachable: true, latencyMs: 50 }),
          makePingRecord({ isReachable: true, latencyMs: 10 }),
          makePingRecord({ isReachable: true, latencyMs: 300 })
        ];

        const dto = PollingMapper.toHistoryDTO(page, DEVICE_UUID, 3);

        expect(dto.statistics.maxResponseTime).toBe(300);
      });

      it('should exclude unreachable records from latency calculations', () => {
        const page = [
          makePingRecord({ isReachable: true, latencyMs: 40 }),
          makePingRecord({ isReachable: false, latencyMs: null }),
          makePingRecord({ isReachable: true, latencyMs: 60 })
        ];

        const dto = PollingMapper.toHistoryDTO(page, DEVICE_UUID, 3);

        expect(dto.statistics.averageResponseTime).toBe(50);
        expect(dto.statistics.minResponseTime).toBe(40);
        expect(dto.statistics.maxResponseTime).toBe(60);
      });

      it('should exclude records where latencyMs is null even if isReachable is true', () => {
        const page = [
          makePingRecord({ isReachable: true, latencyMs: null }),
          makePingRecord({ isReachable: true, latencyMs: 80 })
        ];

        const dto = PollingMapper.toHistoryDTO(page, DEVICE_UUID, 2);

        expect(dto.statistics.averageResponseTime).toBe(80);
        expect(dto.statistics.minResponseTime).toBe(80);
        expect(dto.statistics.maxResponseTime).toBe(80);
      });

      it('should set averageResponseTime to 0 when no reachable records exist', () => {
        const page = [
          makePingRecord({ isReachable: false, latencyMs: null })
        ];

        const dto = PollingMapper.toHistoryDTO(page, DEVICE_UUID, 1);

        expect(dto.statistics.averageResponseTime).toBe(0);
      });

      it('should set minResponseTime to 0 when no reachable records exist', () => {
        const page = [
          makePingRecord({ isReachable: false, latencyMs: null })
        ];

        const dto = PollingMapper.toHistoryDTO(page, DEVICE_UUID, 1);

        expect(dto.statistics.minResponseTime).toBe(0);
      });

      it('should set maxResponseTime to 0 when no reachable records exist', () => {
        const page = [
          makePingRecord({ isReachable: false, latencyMs: null })
        ];

        const dto = PollingMapper.toHistoryDTO(page, DEVICE_UUID, 1);

        expect(dto.statistics.maxResponseTime).toBe(0);
      });
    });

    // ------------------------------------------------------------------------
    describe('edge case — empty page', () => {
      it('should return an empty results array', () => {
        const dto = PollingMapper.toHistoryDTO([], DEVICE_UUID, 0);

        expect(dto.results).toEqual([]);
      });

      it('should set all statistics to 0 for an empty page with zero totalCount', () => {
        const dto = PollingMapper.toHistoryDTO([], DEVICE_UUID, 0);

        expect(dto.statistics.successRate).toBe(0);
        expect(dto.statistics.averageResponseTime).toBe(0);
        expect(dto.statistics.minResponseTime).toBe(0);
        expect(dto.statistics.maxResponseTime).toBe(0);
        expect(dto.statistics.uptimePercentage).toBe(0);
      });

      it('should set all statistics to 0 for an empty page with non-zero totalCount', () => {
        // Non-zero totalCount with empty page is an unlikely but valid edge case
        // (e.g., page offset beyond available records)
        const dto = PollingMapper.toHistoryDTO([], DEVICE_UUID, 10);

        expect(dto.statistics.successRate).toBe(0);
        expect(dto.statistics.averageResponseTime).toBe(0);
      });
    });

    // ------------------------------------------------------------------------
    describe('edge case — single record in page', () => {
      it('should compute averageResponseTime equal to minResponseTime equal to maxResponseTime for a single record', () => {
        const page = [
          makePingRecord({ isReachable: true, latencyMs: 123 })
        ];

        const dto = PollingMapper.toHistoryDTO(page, DEVICE_UUID, 1);

        expect(dto.statistics.averageResponseTime).toBe(123);
        expect(dto.statistics.minResponseTime).toBe(123);
        expect(dto.statistics.maxResponseTime).toBe(123);
      });
    });
  });

  // ==========================================================================
  describe('toDTO()', () => {
    // ------------------------------------------------------------------------
    describe('field mapping', () => {
      it('should map id as the string representation of config.id', () => {
        const config = makePollingConfig();

        const dto = PollingMapper.toDTO(config);

        expect(dto.id).toBe(CONFIG_UUID);
      });

      it('should map deviceId as the string representation of config.deviceId', () => {
        const config = makePollingConfig();

        const dto = PollingMapper.toDTO(config);

        expect(dto.deviceId).toBe(DEVICE_UUID);
      });

      it('should map ipAddress to the value string when an IP is present', () => {
        const config = makePollingConfig({ ipAddress: TEST_IP });

        const dto = PollingMapper.toDTO(config);

        expect(dto.ipAddress).toBe(TEST_IP);
      });

      it('should map ipAddress to null when no IP is configured', () => {
        const config = makePollingConfig({ ipAddress: null });

        const dto = PollingMapper.toDTO(config);

        expect(dto.ipAddress).toBeNull();
      });

      it('should map intervalSeconds from config.interval.seconds', () => {
        const config = makePollingConfig({ intervalSeconds: 120 });

        const dto = PollingMapper.toDTO(config);

        expect(dto.intervalSeconds).toBe(120);
      });

      it('should map failuresBeforeDown from config.failuresBeforeDown.value', () => {
        const config = makePollingConfig({ failureCount: 5 });

        const dto = PollingMapper.toDTO(config);

        expect(dto.failuresBeforeDown).toBe(5);
      });

      it('should map enabled from config.enabled when true', () => {
        const config = makePollingConfig({ enabled: true });

        const dto = PollingMapper.toDTO(config);

        expect(dto.enabled).toBe(true);
      });

      it('should map enabled from config.enabled when false', () => {
        const config = makePollingConfig({ enabled: false });

        const dto = PollingMapper.toDTO(config);

        expect(dto.enabled).toBe(false);
      });

      it('should produce identical output on repeated calls with the same input (pure transformation)', () => {
        const config = makePollingConfig({
          intervalSeconds: 30,
          failureCount: 2,
          enabled: true
        });

        expect(PollingMapper.toDTO(config)).toEqual(
          PollingMapper.toDTO(config)
        );
      });
    });
  });

  // ==========================================================================
  describe('extractCreateData()', () => {
    // ------------------------------------------------------------------------
    describe('required fields', () => {
      it('should pass deviceId through as-is', () => {
        const result = PollingMapper.extractCreateData({
          deviceId: DEVICE_UUID
        });

        expect(result.deviceId).toBe(DEVICE_UUID);
      });
    });

    // ------------------------------------------------------------------------
    describe('optional fields — absent', () => {
      it('should default ipAddress to null when absent', () => {
        const result = PollingMapper.extractCreateData({
          deviceId: DEVICE_UUID
        });

        expect(result.ipAddress).toBeNull();
      });

      it('should default intervalSeconds to null when absent', () => {
        const result = PollingMapper.extractCreateData({
          deviceId: DEVICE_UUID
        });

        expect(result.intervalSeconds).toBeNull();
      });

      it('should default failuresBeforeDown to null when absent', () => {
        const result = PollingMapper.extractCreateData({
          deviceId: DEVICE_UUID
        });

        expect(result.failuresBeforeDown).toBeNull();
      });

      it('should default enabled to null when absent', () => {
        const result = PollingMapper.extractCreateData({
          deviceId: DEVICE_UUID
        });

        expect(result.enabled).toBeNull();
      });
    });

    // ------------------------------------------------------------------------
    describe('optional fields — provided', () => {
      it('should pass through ipAddress when provided', () => {
        const result = PollingMapper.extractCreateData({
          deviceId: DEVICE_UUID,
          ipAddress: TEST_IP
        });

        expect(result.ipAddress).toBe(TEST_IP);
      });

      it('should treat explicit null ipAddress as null', () => {
        const result = PollingMapper.extractCreateData({
          deviceId: DEVICE_UUID,
          ipAddress: null
        });

        expect(result.ipAddress).toBeNull();
      });

      it('should pass through intervalSeconds when provided', () => {
        const result = PollingMapper.extractCreateData({
          deviceId: DEVICE_UUID,
          intervalSeconds: 90
        });

        expect(result.intervalSeconds).toBe(90);
      });

      it('should pass through failuresBeforeDown when provided', () => {
        const result = PollingMapper.extractCreateData({
          deviceId: DEVICE_UUID,
          failuresBeforeDown: 4
        });

        expect(result.failuresBeforeDown).toBe(4);
      });

      it('should pass through enabled as true when provided', () => {
        const result = PollingMapper.extractCreateData({
          deviceId: DEVICE_UUID,
          enabled: true
        });

        expect(result.enabled).toBe(true);
      });

      it('should pass through enabled as false when provided', () => {
        const result = PollingMapper.extractCreateData({
          deviceId: DEVICE_UUID,
          enabled: false
        });

        expect(result.enabled).toBe(false);
      });
    });
  });

  // ==========================================================================
  describe('extractUpdateData()', () => {
    // ------------------------------------------------------------------------
    describe('when no fields are provided', () => {
      it('should return an empty object', () => {
        const result = PollingMapper.extractUpdateData({
          deviceId: DEVICE_UUID
        });

        expect(result).toEqual({});
      });
    });

    // ------------------------------------------------------------------------
    describe('when fields are provided', () => {
      it('should include intervalSeconds when provided', () => {
        const result = PollingMapper.extractUpdateData({
          deviceId: DEVICE_UUID,
          intervalSeconds: 60
        });

        expect(result.intervalSeconds).toBe(60);
      });

      it('should include failuresBeforeDown when provided', () => {
        const result = PollingMapper.extractUpdateData({
          deviceId: DEVICE_UUID,
          failuresBeforeDown: 3
        });

        expect(result.failuresBeforeDown).toBe(3);
      });

      it('should include enabled as true when provided', () => {
        const result = PollingMapper.extractUpdateData({
          deviceId: DEVICE_UUID,
          enabled: true
        });

        expect(result.enabled).toBe(true);
      });

      it('should include enabled as false when provided', () => {
        const result = PollingMapper.extractUpdateData({
          deviceId: DEVICE_UUID,
          enabled: false
        });

        expect(result.enabled).toBe(false);
      });

      it('should include all provided fields when all are specified', () => {
        const result = PollingMapper.extractUpdateData({
          deviceId: DEVICE_UUID,
          intervalSeconds: 45,
          failuresBeforeDown: 2,
          enabled: false
        });

        expect(result).toEqual({
          intervalSeconds: 45,
          failuresBeforeDown: 2,
          enabled: false
        });
      });
    });

    // ------------------------------------------------------------------------
    describe('when fields are absent', () => {
      it('should omit intervalSeconds when undefined', () => {
        const result = PollingMapper.extractUpdateData({
          deviceId: DEVICE_UUID
        });

        expect('intervalSeconds' in result).toBe(false);
      });

      it('should omit failuresBeforeDown when undefined', () => {
        const result = PollingMapper.extractUpdateData({
          deviceId: DEVICE_UUID
        });

        expect('failuresBeforeDown' in result).toBe(false);
      });

      it('should omit enabled when undefined', () => {
        const result = PollingMapper.extractUpdateData({
          deviceId: DEVICE_UUID
        });

        expect('enabled' in result).toBe(false);
      });
    });
  });

  // ==========================================================================
  describe('mapper compliance', () => {
    it('should expose toStatusDTO as a static method', () => {
      expect(typeof PollingMapper.toStatusDTO).toBe('function');
    });

    it('should expose toSkippedResultDTO as a static method', () => {
      expect(typeof PollingMapper.toSkippedResultDTO).toBe(
        'function'
      );
    });

    it('should expose toPollResultDTO as a static method', () => {
      expect(typeof PollingMapper.toPollResultDTO).toBe('function');
    });

    it('should expose toHistoryDTO as a static method', () => {
      expect(typeof PollingMapper.toHistoryDTO).toBe('function');
    });

    it('should expose toDTO as a static method', () => {
      expect(typeof PollingMapper.toDTO).toBe('function');
    });

    it('should expose extractCreateData as a static method', () => {
      expect(typeof PollingMapper.extractCreateData).toBe('function');
    });

    it('should expose extractUpdateData as a static method', () => {
      expect(typeof PollingMapper.extractUpdateData).toBe('function');
    });

    it('should produce identical output on repeated calls with the same inputs (deterministic)', () => {
      const config = makePollingConfig({ intervalSeconds: 60 });
      const state = makeDeviceState({
        isOnline: true,
        consecutiveFailures: 0
      });
      const ping = makePingRecord({
        isReachable: true,
        latencyMs: 20
      });

      const dto1 = PollingMapper.toStatusDTO(config, state, ping);
      const dto2 = PollingMapper.toStatusDTO(config, state, ping);

      expect(dto1).toEqual(dto2);
    });
  });
});
