// Source: src/domain/wireless-monitoring/events/WirelessAlertTriggered.ts

import { WirelessAlertTriggeredEvent } from '../../../../src/domain/wireless-monitoring/events/WirelessAlertTriggered';
import { WirelessAlertTriggeredEventProps } from '../../../../src/domain/wireless-monitoring/props/WirelessAlertTriggeredEventProps';
import { WirelessAlert } from '../../../../src/domain/wireless-monitoring/value-objects/WirelessAlert';
import { WirelessAlertProps } from '../../../../src/domain/wireless-monitoring/props/WirelessAlertProps';
import { SnapshotId, DeviceId } from '../../../../src/domain/shared/ids';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FIXED_DATE = new Date('2026-03-10T08:00:00.000Z');

function makeAlertProps(overrides: Partial<WirelessAlertProps> = {}): WirelessAlertProps {
  return {
    metric: 'signalRxDbm',
    severity: 'WARNING',
    threshold: -70,
    currentValue: -75,
    message: 'Signal has dropped below the warning threshold.',
    triggeredAt: new Date('2026-03-10T07:55:00.000Z'),
    ...overrides,
  };
}

function makeAlert(overrides: Partial<WirelessAlertProps> = {}): WirelessAlert {
  return WirelessAlert.create(makeAlertProps(overrides)).value;
}

function makeEvent(
  overrides: Partial<WirelessAlertTriggeredEventProps> = {}
): WirelessAlertTriggeredEvent {
  return new WirelessAlertTriggeredEvent({
    aggregateId: SnapshotId.create(),
    deviceId: DeviceId.create(),
    alerts: [makeAlert()],
    dateTimeOccurred: FIXED_DATE,
    ...overrides,
  });
}

// ---------------------------------------------------------------------------

describe('[WLS-122] WirelessAlertTriggeredEvent', () => {
  let aggregateId: SnapshotId;
  let deviceId: DeviceId;

  beforeEach(() => {
    aggregateId = SnapshotId.create();
    deviceId = DeviceId.create();
  });

  // -------------------------------------------------------------------------
  describe('constructor', () => {
    it('should create an event with all props accessible via getters', () => {
      const alerts = [makeAlert()];
      const event = makeEvent({ aggregateId, deviceId, alerts });

      expect(event.aggregateId).toBe(aggregateId);
      expect(event.deviceId).toBe(deviceId);
      expect(event.alerts).toBe(alerts);
      expect(event.dateTimeOccurred).toBe(FIXED_DATE);
    });
  });

  // -------------------------------------------------------------------------
  describe('immutability', () => {
    it('should freeze props to prevent external mutation', () => {
      const event = makeEvent();

      expect(
        Object.isFrozen((event as unknown as { props: unknown }).props)
      ).toBe(true);
    });

    it('should not allow mutation of props after construction', () => {
      const event = makeEvent();

      expect(() => {
        (event as unknown as { props: { alerts: WirelessAlert[] } }).props.alerts = [];
      }).toThrow();
    });

    it('should not allow adding new properties to props', () => {
      const event = makeEvent();

      expect(() => {
        (event as unknown as { props: Record<string, unknown> }).props.extra = 'value';
      }).toThrow();
    });
  });

  // -------------------------------------------------------------------------
  describe('aggregateId getter', () => {
    it('should return the SnapshotId provided at construction', () => {
      const event = makeEvent({ aggregateId });

      expect(event.aggregateId).toBe(aggregateId);
    });

    it('should return the same reference on repeated reads', () => {
      const event = makeEvent({ aggregateId });

      expect(event.aggregateId).toBe(event.aggregateId);
    });
  });

  // -------------------------------------------------------------------------
  describe('deviceId getter', () => {
    it('should return the DeviceId provided at construction', () => {
      const event = makeEvent({ deviceId });

      expect(event.deviceId).toBe(deviceId);
    });
  });

  // -------------------------------------------------------------------------
  describe('alerts getter', () => {
    it('should return the same array reference passed in props', () => {
      const alerts: ReadonlyArray<WirelessAlert> = [makeAlert()];
      const event = makeEvent({ alerts });

      expect(event.alerts).toBe(alerts);
    });

    it('should expose alert properties when a single alert is present', () => {
      const alert = makeAlert({ metric: 'ccq', severity: 'CRITICAL', currentValue: 40 });
      const event = makeEvent({ alerts: [alert] });

      expect(event.alerts).toHaveLength(1);
      expect(event.alerts[0].metric).toBe('ccq');
      expect(event.alerts[0].severity).toBe('CRITICAL');
      expect(event.alerts[0].currentValue).toBe(40);
    });

    it('should preserve the correct length when multiple alerts are present', () => {
      const alerts = [
        makeAlert({ metric: 'signalRxDbm', severity: 'WARNING' }),
        makeAlert({ metric: 'ccq', severity: 'CRITICAL' }),
        makeAlert({ metric: 'noiseFloor', severity: 'WARNING' }),
      ];
      const event = makeEvent({ alerts });

      expect(event.alerts).toHaveLength(3);
    });

    it('should return the same value on repeated reads', () => {
      const event = makeEvent();

      expect(event.alerts).toBe(event.alerts);
    });
  });

  // -------------------------------------------------------------------------
  describe('dateTimeOccurred getter', () => {
    it('should return the Date provided at construction', () => {
      const event = makeEvent({ dateTimeOccurred: FIXED_DATE });

      expect(event.dateTimeOccurred).toBe(FIXED_DATE);
    });

    it('should be a Date instance', () => {
      const event = makeEvent();

      expect(event.dateTimeOccurred).toBeInstanceOf(Date);
    });
  });

  // -------------------------------------------------------------------------
  describe('toString()', () => {
    it('should contain the event class name', () => {
      const event = makeEvent();

      expect(event.toString()).toContain('WirelessAlertTriggeredEvent');
    });

    it('should contain the aggregate ID string value', () => {
      const event = makeEvent({ aggregateId });

      expect(event.toString()).toContain(aggregateId.toString());
    });

    it('should contain the ISO timestamp of dateTimeOccurred', () => {
      const event = makeEvent({ dateTimeOccurred: FIXED_DATE });

      expect(event.toString()).toContain(FIXED_DATE.toISOString());
    });

    it('should return a consistent string across multiple calls', () => {
      const event = makeEvent();

      expect(event.toString()).toBe(event.toString());
    });
  });

  // -------------------------------------------------------------------------
  describe('multiple independent instances', () => {
    it('should not share state between two events', () => {
      const id1 = SnapshotId.create();
      const id2 = SnapshotId.create();
      const alerts1 = [makeAlert({ metric: 'signalRxDbm' })];
      const alerts2 = [makeAlert({ metric: 'ccq' }), makeAlert({ metric: 'noiseFloor' })];
      const event1 = makeEvent({ aggregateId: id1, alerts: alerts1 });
      const event2 = makeEvent({ aggregateId: id2, alerts: alerts2 });

      expect(event1.aggregateId).not.toBe(event2.aggregateId);
      expect(event1.alerts).not.toBe(event2.alerts);
      expect(event1.alerts).toHaveLength(1);
      expect(event2.alerts).toHaveLength(2);
    });
  });
});
