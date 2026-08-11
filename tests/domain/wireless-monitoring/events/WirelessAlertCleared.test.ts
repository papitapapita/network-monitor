// Source: src/domain/wireless-monitoring/events/WirelessAlertCleared.ts

import { WirelessAlertClearedEvent } from '../../../../src/domain/wireless-monitoring/events/WirelessAlertCleared';
import { WirelessAlertClearedEventProps } from '../../../../src/domain/wireless-monitoring/props/WirelessAlertClearedEventProps';
import { WirelessAlertRecordId, DeviceId } from '../../../../src/domain/shared/ids';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FIXED_DATE = new Date('2026-03-10T08:00:00.000Z');
const FIXED_CLEARED = new Date('2026-03-10T09:00:00.000Z');

function makeEvent(
  overrides: Partial<WirelessAlertClearedEventProps> = {}
): WirelessAlertClearedEvent {
  return new WirelessAlertClearedEvent({
    aggregateId: WirelessAlertRecordId.create(),
    deviceId: DeviceId.create(),
    metric: 'signalRxDbm',
    severity: 'WARNING',
    clearedAt: FIXED_CLEARED,
    dateTimeOccurred: FIXED_DATE,
    ...overrides,
  });
}

// ---------------------------------------------------------------------------

describe('[WLS-121] WirelessAlertClearedEvent', () => {
  let aggregateId: WirelessAlertRecordId;
  let deviceId: DeviceId;

  beforeEach(() => {
    aggregateId = WirelessAlertRecordId.create();
    deviceId = DeviceId.create();
  });

  // -------------------------------------------------------------------------
  describe('constructor', () => {
    it('should create an event with all props accessible via getters', () => {
      const event = makeEvent({ aggregateId, deviceId });

      expect(event.aggregateId).toBe(aggregateId);
      expect(event.deviceId).toBe(deviceId);
      expect(event.metric).toBe('signalRxDbm');
      expect(event.severity).toBe('WARNING');
      expect(event.clearedAt).toBe(FIXED_CLEARED);
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
        (event as unknown as { props: { metric: string } }).props.metric = 'ccq';
      }).toThrow();
    });

    it('should not allow adding new properties to props', () => {
      const event = makeEvent();

      expect(() => {
        (event as unknown as { props: Record<string, unknown> }).props.extra = 'value';
      }).toThrow();
    });

    it('should isolate event state from external mutation of the original props object', () => {
      const props: WirelessAlertClearedEventProps = {
        aggregateId: WirelessAlertRecordId.create(),
        deviceId: DeviceId.create(),
        metric: 'ccq',
        severity: 'WARNING',
        clearedAt: FIXED_CLEARED,
        dateTimeOccurred: FIXED_DATE,
      };
      const event = new WirelessAlertClearedEvent(props);

      (props as { metric: string }).metric = 'noiseFloor';

      expect(event.metric).toBe('ccq');
    });
  });

  // -------------------------------------------------------------------------
  describe('aggregateId getter', () => {
    it('should return the WirelessAlertRecordId provided at construction', () => {
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
  describe('metric getter', () => {
    it('should return the metric string provided at construction', () => {
      const event = makeEvent({ metric: 'noiseFloor' });

      expect(event.metric).toBe('noiseFloor');
    });

    it('should return the same value on repeated reads', () => {
      const event = makeEvent({ metric: 'ccq' });

      expect(event.metric).toBe(event.metric);
    });
  });

  // -------------------------------------------------------------------------
  describe('severity getter', () => {
    it('should return WARNING when constructed with WARNING', () => {
      const event = makeEvent({ severity: 'WARNING' });

      expect(event.severity).toBe('WARNING');
    });

    it('should return CRITICAL when constructed with CRITICAL', () => {
      const event = makeEvent({ severity: 'CRITICAL' });

      expect(event.severity).toBe('CRITICAL');
    });

    it('should return the same value on repeated reads', () => {
      const event = makeEvent({ severity: 'WARNING' });

      expect(event.severity).toBe(event.severity);
    });
  });

  // -------------------------------------------------------------------------
  describe('clearedAt getter', () => {
    it('should return the Date provided at construction', () => {
      const event = makeEvent({ clearedAt: FIXED_CLEARED });

      expect(event.clearedAt).toBe(FIXED_CLEARED);
    });

    it('should be a Date instance', () => {
      const event = makeEvent();

      expect(event.clearedAt).toBeInstanceOf(Date);
    });

    it('should be independent from dateTimeOccurred', () => {
      const event = makeEvent({ clearedAt: FIXED_CLEARED, dateTimeOccurred: FIXED_DATE });

      expect(event.clearedAt).not.toBe(event.dateTimeOccurred);
      expect(event.clearedAt).toBe(FIXED_CLEARED);
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

      expect(event.toString()).toContain('WirelessAlertClearedEvent');
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
      const id1 = WirelessAlertRecordId.create();
      const id2 = WirelessAlertRecordId.create();
      const event1 = makeEvent({ aggregateId: id1, severity: 'WARNING' });
      const event2 = makeEvent({ aggregateId: id2, severity: 'CRITICAL' });

      expect(event1.aggregateId).not.toBe(event2.aggregateId);
      expect(event1.severity).not.toBe(event2.severity);
    });

    it('should reflect different clearedAt timestamps when created with different values', () => {
      const earlier = new Date('2026-01-01T00:00:00Z');
      const later = new Date('2026-12-31T23:59:59Z');
      const event1 = makeEvent({ clearedAt: earlier });
      const event2 = makeEvent({ clearedAt: later });

      expect(event2.clearedAt.getTime()).toBeGreaterThan(event1.clearedAt.getTime());
    });
  });
});
