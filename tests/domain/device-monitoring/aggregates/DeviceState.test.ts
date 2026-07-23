// Source: src/domain/device-monitoring/aggregates/DeviceState.ts

import { DeviceState } from '../../../../src/domain/device-monitoring/aggregates/DeviceState';
import { DeviceId } from '../../../../src/domain/shared/ids/DeviceId';
import { DeviceCameOnlineEvent } from '../../../../src/domain/device-monitoring/events/DeviceCameOnlineEvent';
import { DeviceWentOfflineEvent } from '../../../../src/domain/device-monitoring/events/DeviceWentOfflineEvent';
import { DeviceStateProps } from '../../../../src/domain/device-monitoring/props/DeviceStateProps';

// ---------------------------------------------------------------------------
// Constants & Fixtures
// ---------------------------------------------------------------------------

const VALID_DEVICE_UUID    = '550e8400-e29b-41d4-a716-446655440001';
const FIXED_DATE           = new Date('2024-06-01T10:00:00.000Z');
const LATER_DATE           = new Date('2024-06-01T11:00:00.000Z');

function makeDeviceId(): DeviceId {
  return DeviceId.parse(VALID_DEVICE_UUID).value;
}

/** Build a fully-populated props object, used with reconstitute(). */
function makeStateProps(overrides: Partial<DeviceStateProps> = {}): DeviceStateProps {
  return {
    deviceId:             makeDeviceId(),
    isOnline:             true,
    lastSeen:             FIXED_DATE,
    lastLatencyMs:        20,
    consecutiveFailures:  0,
    lastCheckedAt:        FIXED_DATE,
    updatedAt:            FIXED_DATE,
    ...overrides
  };
}

function makeState(overrides: Partial<DeviceStateProps> = {}): DeviceState {
  const props = makeStateProps(overrides);
  return DeviceState.reconstitute(props.deviceId, props);
}

// ---------------------------------------------------------------------------

describe('DeviceState', () => {

  // ===========================================================================
  describe('createInitial()', () => {
    it('should return a DeviceState instance', () => {
      const state = DeviceState.createInitial(makeDeviceId());

      expect(state).toBeInstanceOf(DeviceState);
    });

    it('should set isOnline to false', () => {
      const state = DeviceState.createInitial(makeDeviceId());

      expect(state.isOnline).toBe(false);
    });

    it('should set consecutiveFailures to 0', () => {
      const state = DeviceState.createInitial(makeDeviceId());

      expect(state.consecutiveFailures).toBe(0);
    });

    it('should set lastSeen to null', () => {
      const state = DeviceState.createInitial(makeDeviceId());

      expect(state.lastSeen).toBeNull();
    });

    it('should set lastLatencyMs to null', () => {
      const state = DeviceState.createInitial(makeDeviceId());

      expect(state.lastLatencyMs).toBeNull();
    });

    it('should set lastCheckedAt to null', () => {
      const state = DeviceState.createInitial(makeDeviceId());

      expect(state.lastCheckedAt).toBeNull();
    });

    it('should use the supplied deviceId as its aggregate id', () => {
      const deviceId = makeDeviceId();
      const state    = DeviceState.createInitial(deviceId);

      expect(state.id.toString()).toBe(VALID_DEVICE_UUID);
    });

    it('should expose the supplied deviceId via the deviceId getter', () => {
      const deviceId = makeDeviceId();
      const state    = DeviceState.createInitial(deviceId);

      expect(state.deviceId.toString()).toBe(VALID_DEVICE_UUID);
    });
  });

  // ===========================================================================
  describe('reconstitute()', () => {
    it('should return a DeviceState instance', () => {
      const state = makeState();

      expect(state).toBeInstanceOf(DeviceState);
    });

    it('should preserve isOnline', () => {
      const state = makeState({ isOnline: false });

      expect(state.isOnline).toBe(false);
    });

    it('should preserve lastSeen', () => {
      const state = makeState({ lastSeen: FIXED_DATE });

      expect(state.lastSeen).toEqual(FIXED_DATE);
    });

    it('should preserve null lastSeen', () => {
      const state = makeState({ lastSeen: null });

      expect(state.lastSeen).toBeNull();
    });

    it('should preserve lastLatencyMs', () => {
      const state = makeState({ lastLatencyMs: 42 });

      expect(state.lastLatencyMs).toBe(42);
    });

    it('should preserve null lastLatencyMs', () => {
      const state = makeState({ lastLatencyMs: null });

      expect(state.lastLatencyMs).toBeNull();
    });

    it('should preserve consecutiveFailures', () => {
      const state = makeState({ consecutiveFailures: 5 });

      expect(state.consecutiveFailures).toBe(5);
    });

    it('should preserve lastCheckedAt', () => {
      const state = makeState({ lastCheckedAt: FIXED_DATE });

      expect(state.lastCheckedAt).toEqual(FIXED_DATE);
    });

  });

  // ===========================================================================
  describe('applyPingResult()', () => {
    // -------------------------------------------------------------------------
    describe('successful ping (isReachable = true)', () => {
      it('should set isOnline to true', () => {
        const state = makeState({ isOnline: false, consecutiveFailures: 2 });

        state.applyPingResult(true, 15, LATER_DATE, false);

        expect(state.isOnline).toBe(true);
      });

      it('should reset consecutiveFailures to 0', () => {
        const state = makeState({ isOnline: true, consecutiveFailures: 2 });

        state.applyPingResult(true, 15, LATER_DATE, false);

        expect(state.consecutiveFailures).toBe(0);
      });

      it('should update lastSeen to the checkedAt timestamp', () => {
        const state = makeState({ lastSeen: FIXED_DATE });

        state.applyPingResult(true, 15, LATER_DATE, false);

        expect(state.lastSeen).toEqual(LATER_DATE);
      });

      it('should set lastLatencyMs to the provided latency', () => {
        const state = makeState({ lastLatencyMs: null });

        state.applyPingResult(true, 99, LATER_DATE, false);

        expect(state.lastLatencyMs).toBe(99);
      });

      it('should update lastCheckedAt to the checkedAt timestamp', () => {
        const state = makeState({ lastCheckedAt: FIXED_DATE });

        state.applyPingResult(true, 15, LATER_DATE, false);

        expect(state.lastCheckedAt).toEqual(LATER_DATE);
      });

      it('should accept null latencyMs on a successful ping', () => {
        const state = makeState({ lastLatencyMs: 20 });

        state.applyPingResult(true, null, LATER_DATE, false);

        expect(state.lastLatencyMs).toBeNull();
      });
    });

    // -------------------------------------------------------------------------
    describe('failed ping (isReachable = false)', () => {
      it('should set isOnline to false immediately, regardless of previous state', () => {
        const state = makeState({ isOnline: true, consecutiveFailures: 0 });

        state.applyPingResult(false, null, LATER_DATE, false);

        expect(state.isOnline).toBe(false);
      });

      it('should increment consecutiveFailures by 1', () => {
        const state = makeState({ isOnline: true, consecutiveFailures: 1 });

        state.applyPingResult(false, null, LATER_DATE, false);

        expect(state.consecutiveFailures).toBe(2);
      });

      it('should NOT update lastSeen when ping fails', () => {
        const state = makeState({ isOnline: true, lastSeen: FIXED_DATE });

        state.applyPingResult(false, null, LATER_DATE, false);

        expect(state.lastSeen).toEqual(FIXED_DATE);
      });

      it('should update lastCheckedAt even on a failed ping', () => {
        const state = makeState({ lastCheckedAt: FIXED_DATE });

        state.applyPingResult(false, null, LATER_DATE, false);

        expect(state.lastCheckedAt).toEqual(LATER_DATE);
      });
    });

    // -------------------------------------------------------------------------
    describe('domain event — online → offline transition', () => {
      it('should raise a DeviceWentOfflineEvent when the device transitions from online to offline', () => {
        const state = makeState({ isOnline: true, consecutiveFailures: 0 });

        state.applyPingResult(false, null, LATER_DATE, false);

        const events = state.domainEvents;
        expect(events).toHaveLength(1);
        expect(events[0]).toBeInstanceOf(DeviceWentOfflineEvent);
      });

      it('should attach the correct consecutiveFailures to the DeviceWentOfflineEvent', () => {
        const state = makeState({ isOnline: true, consecutiveFailures: 2 });

        state.applyPingResult(false, null, LATER_DATE, false);

        const event = state.domainEvents[0] as DeviceWentOfflineEvent;
        expect(event.consecutiveFailures).toBe(3);
      });

      it('should attach the checkedAt timestamp to the DeviceWentOfflineEvent', () => {
        const state = makeState({ isOnline: true, consecutiveFailures: 0 });

        state.applyPingResult(false, null, LATER_DATE, false);

        const event = state.domainEvents[0] as DeviceWentOfflineEvent;
        expect(event.dateTimeOccurred).toEqual(LATER_DATE);
      });

      it('should attach the aggregate id to the DeviceWentOfflineEvent', () => {
        const state = makeState({ isOnline: true, consecutiveFailures: 0 });

        state.applyPingResult(false, null, LATER_DATE, false);

        const event = state.domainEvents[0] as DeviceWentOfflineEvent;
        expect(event.aggregateId.toString()).toBe(VALID_DEVICE_UUID);
      });
    });

    // -------------------------------------------------------------------------
    describe('domain event — offline → online transition', () => {
      it('should raise a DeviceCameOnlineEvent when the device transitions from offline to online', () => {
        const state = makeState({ isOnline: false, consecutiveFailures: 3 });

        state.applyPingResult(true, 12, LATER_DATE, false);

        const events = state.domainEvents;
        expect(events).toHaveLength(1);
        expect(events[0]).toBeInstanceOf(DeviceCameOnlineEvent);
      });

      it('should attach the latencyMs to the DeviceCameOnlineEvent', () => {
        const state = makeState({ isOnline: false, consecutiveFailures: 3 });

        state.applyPingResult(true, 55, LATER_DATE, false);

        const event = state.domainEvents[0] as DeviceCameOnlineEvent;
        expect(event.latencyMs).toBe(55);
      });

      it('should attach null latencyMs to the DeviceCameOnlineEvent when no latency is reported', () => {
        const state = makeState({ isOnline: false, consecutiveFailures: 3 });

        state.applyPingResult(true, null, LATER_DATE, false);

        const event = state.domainEvents[0] as DeviceCameOnlineEvent;
        expect(event.latencyMs).toBeNull();
      });

      it('should attach the checkedAt timestamp to the DeviceCameOnlineEvent', () => {
        const state = makeState({ isOnline: false, consecutiveFailures: 3 });

        state.applyPingResult(true, 12, LATER_DATE, false);

        const event = state.domainEvents[0] as DeviceCameOnlineEvent;
        expect(event.dateTimeOccurred).toEqual(LATER_DATE);
      });

      it('should attach the aggregate id to the DeviceCameOnlineEvent', () => {
        const state = makeState({ isOnline: false, consecutiveFailures: 3 });

        state.applyPingResult(true, 12, LATER_DATE, false);

        const event = state.domainEvents[0] as DeviceCameOnlineEvent;
        expect(event.aggregateId.toString()).toBe(VALID_DEVICE_UUID);
      });
    });

    // -------------------------------------------------------------------------
    describe('no domain event raised — steady state', () => {
      it('should not raise any event when the device was already online and ping succeeds', () => {
        const state = makeState({ isOnline: true, consecutiveFailures: 0 });

        state.applyPingResult(true, 10, LATER_DATE, false);

        expect(state.domainEvents).toHaveLength(0);
      });

      it('should not raise any event when the device was already offline and ping fails again', () => {
        const state = makeState({ isOnline: false, consecutiveFailures: 3 });

        state.applyPingResult(false, null, LATER_DATE, false);

        expect(state.domainEvents).toHaveLength(0);
      });
    });

    // -------------------------------------------------------------------------
    describe('isFirstPoll = true — unknown previous state', () => {
      it('should NOT raise DeviceCameOnlineEvent on the first poll even when offline→online', () => {
        const state = makeState({ isOnline: false, consecutiveFailures: 0 });

        state.applyPingResult(true, 10, LATER_DATE, true);

        expect(state.domainEvents).toHaveLength(0);
      });

      it('should raise DeviceWentOfflineEvent on the first poll when unreachable', () => {
        const state = DeviceState.createInitial(makeDeviceId());

        state.applyPingResult(false, null, LATER_DATE, true);

        const events = state.domainEvents;
        expect(events).toHaveLength(1);
        expect(events[0]).toBeInstanceOf(DeviceWentOfflineEvent);
      });

      it('should report a single consecutive failure on a first-poll outage', () => {
        const state = DeviceState.createInitial(makeDeviceId());

        state.applyPingResult(false, null, LATER_DATE, true);

        const event = state.domainEvents[0] as DeviceWentOfflineEvent;
        expect(event.consecutiveFailures).toBe(1);
      });

      it('should raise DeviceWentOfflineEvent on a first-poll outage regardless of the seeded isOnline flag', () => {
        const state = makeState({ isOnline: true, consecutiveFailures: 0 });

        state.applyPingResult(false, null, LATER_DATE, true);

        expect(state.domainEvents).toHaveLength(1);
        expect(state.domainEvents[0]).toBeInstanceOf(DeviceWentOfflineEvent);
      });

      it('should still update isOnline to true on the first poll when reachable', () => {
        const state = makeState({ isOnline: false, consecutiveFailures: 0 });

        state.applyPingResult(true, 10, LATER_DATE, true);

        expect(state.isOnline).toBe(true);
      });

      it('should still update isOnline to false on the first poll when unreachable', () => {
        const state = makeState({ isOnline: true, consecutiveFailures: 0 });

        state.applyPingResult(false, null, LATER_DATE, true);

        expect(state.isOnline).toBe(false);
      });

      it('should still update consecutiveFailures correctly on the first poll', () => {
        const state = makeState({ isOnline: true, consecutiveFailures: 2 });

        state.applyPingResult(false, null, LATER_DATE, true);

        expect(state.consecutiveFailures).toBe(3);
      });
    });
  });
});
