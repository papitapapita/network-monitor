// Source: src/domain/wireless-monitoring/events/WirelessSnapshotCreated.ts
//         src/domain/wireless-monitoring/events/WirelessAlertTriggered.ts
//         src/domain/wireless-monitoring/events/WirelessAlertCleared.ts

import { WirelessSnapshotCreatedEvent } from '../../../../src/domain/wireless-monitoring/events/WirelessSnapshotCreated';
import { WirelessAlertTriggeredEvent } from '../../../../src/domain/wireless-monitoring/events/WirelessAlertTriggered';
import { WirelessAlertClearedEvent } from '../../../../src/domain/wireless-monitoring/events/WirelessAlertCleared';
import { WirelessSnapshotCreatedEventProps } from '../../../../src/domain/wireless-monitoring/props/WirelessSnapshotCreatedEventProps';
import { WirelessAlertTriggeredEventProps } from '../../../../src/domain/wireless-monitoring/props/WirelessAlertTriggeredEventProps';
import { WirelessAlertClearedEventProps } from '../../../../src/domain/wireless-monitoring/props/WirelessAlertClearedEventProps';
import { WirelessAlert } from '../../../../src/domain/wireless-monitoring/value-objects/WirelessAlert';
import { WirelessAlertProps } from '../../../../src/domain/wireless-monitoring/props/WirelessAlertProps';
import { SnapshotId, WirelessAlertRecordId } from '../../../../src/domain/shared/ids';
import { DeviceId, UniqueEntityID } from '../../../../src/domain/shared';
import { DomainEvent } from '../../../../src/domain/shared/core';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FIXED_OCCURRED = new Date('2026-03-10T08:00:00.000Z');
const FIXED_COLLECTED = new Date('2026-03-10T07:59:30.000Z');
const FIXED_CLEARED = new Date('2026-03-10T09:00:00.000Z');

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

function makeSnapshotCreatedProps(
  overrides: Partial<WirelessSnapshotCreatedEventProps> = {}
): WirelessSnapshotCreatedEventProps {
  return {
    aggregateId: SnapshotId.create(),
    deviceId: DeviceId.create(),
    deviceType: 'CPE',
    collectedAt: FIXED_COLLECTED,
    dateTimeOccurred: FIXED_OCCURRED,
    ...overrides,
  };
}

function makeAlertTriggeredProps(
  overrides: Partial<WirelessAlertTriggeredEventProps> = {}
): WirelessAlertTriggeredEventProps {
  return {
    aggregateId: SnapshotId.create(),
    deviceId: DeviceId.create(),
    alerts: [makeAlert()],
    dateTimeOccurred: FIXED_OCCURRED,
    ...overrides,
  };
}

function makeAlertClearedProps(
  overrides: Partial<WirelessAlertClearedEventProps> = {}
): WirelessAlertClearedEventProps {
  return {
    aggregateId: WirelessAlertRecordId.create(),
    deviceId: DeviceId.create(),
    metric: 'signalRxDbm',
    severity: 'WARNING',
    clearedAt: FIXED_CLEARED,
    dateTimeOccurred: FIXED_OCCURRED,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------

describe('WirelessSnapshotCreatedEvent', () => {
  describe('constructor', () => {
    it('should create an event with all props accessible via getters', () => {
      const props = makeSnapshotCreatedProps();
      const event = new WirelessSnapshotCreatedEvent(props);

      expect(event.aggregateId).toBe(props.aggregateId);
      expect(event.deviceId).toBe(props.deviceId);
      expect(event.deviceType).toBe('CPE');
      expect(event.collectedAt).toBe(FIXED_COLLECTED);
      expect(event.dateTimeOccurred).toBe(FIXED_OCCURRED);
    });

    it('should freeze props to prevent external mutation', () => {
      const event = new WirelessSnapshotCreatedEvent(makeSnapshotCreatedProps());

      expect(
        Object.isFrozen((event as unknown as { props: unknown }).props)
      ).toBe(true);
    });

    it('should isolate event state from external mutation of the original props object', () => {
      const aggregateId = SnapshotId.create();
      const props = makeSnapshotCreatedProps({ aggregateId, deviceType: 'CPE' });
      const event = new WirelessSnapshotCreatedEvent(props);

      (props as { deviceType: string }).deviceType = 'ACCESS_POINT';

      expect(event.deviceType).toBe('CPE');
    });
  });

  describe('instanceof checks', () => {
    it('should be an instance of DomainEvent', () => {
      const event = new WirelessSnapshotCreatedEvent(makeSnapshotCreatedProps());

      expect(event).toBeInstanceOf(DomainEvent);
    });

    it('should have an aggregateId that is an instance of SnapshotId', () => {
      const snapshotId = SnapshotId.create();
      const event = new WirelessSnapshotCreatedEvent(
        makeSnapshotCreatedProps({ aggregateId: snapshotId })
      );

      expect(event.aggregateId).toBeInstanceOf(SnapshotId);
      expect(event.aggregateId).toBeInstanceOf(UniqueEntityID);
    });
  });

  describe('deviceType getter', () => {
    it('should return CPE when constructed with CPE', () => {
      const event = new WirelessSnapshotCreatedEvent(
        makeSnapshotCreatedProps({ deviceType: 'CPE' })
      );

      expect(event.deviceType).toBe('CPE');
    });

    it('should return ACCESS_POINT when constructed with ACCESS_POINT', () => {
      const event = new WirelessSnapshotCreatedEvent(
        makeSnapshotCreatedProps({ deviceType: 'ACCESS_POINT' })
      );

      expect(event.deviceType).toBe('ACCESS_POINT');
    });
  });

  describe('toString()', () => {
    it('should include the event class name', () => {
      const event = new WirelessSnapshotCreatedEvent(makeSnapshotCreatedProps());

      expect(event.toString()).toContain('WirelessSnapshotCreatedEvent');
    });

    it('should include the aggregate ID string value', () => {
      const aggregateId = SnapshotId.create();
      const event = new WirelessSnapshotCreatedEvent(
        makeSnapshotCreatedProps({ aggregateId })
      );

      expect(event.toString()).toContain(aggregateId.toString());
    });

    it('should include the ISO timestamp of dateTimeOccurred', () => {
      const event = new WirelessSnapshotCreatedEvent(
        makeSnapshotCreatedProps({ dateTimeOccurred: FIXED_OCCURRED })
      );

      expect(event.toString()).toContain(FIXED_OCCURRED.toISOString());
    });
  });
});

// ---------------------------------------------------------------------------

describe('WirelessAlertTriggeredEvent', () => {
  describe('constructor', () => {
    it('should create an event with all props accessible via getters', () => {
      const alerts = [makeAlert()];
      const props = makeAlertTriggeredProps({ alerts });
      const event = new WirelessAlertTriggeredEvent(props);

      expect(event.aggregateId).toBe(props.aggregateId);
      expect(event.deviceId).toBe(props.deviceId);
      expect(event.alerts).toBe(alerts);
      expect(event.dateTimeOccurred).toBe(FIXED_OCCURRED);
    });

    it('should freeze props to prevent external mutation', () => {
      const event = new WirelessAlertTriggeredEvent(makeAlertTriggeredProps());

      expect(
        Object.isFrozen((event as unknown as { props: unknown }).props)
      ).toBe(true);
    });
  });

  describe('instanceof checks', () => {
    it('should be an instance of DomainEvent', () => {
      const event = new WirelessAlertTriggeredEvent(makeAlertTriggeredProps());

      expect(event).toBeInstanceOf(DomainEvent);
    });

    it('should have an aggregateId that is an instance of SnapshotId', () => {
      const event = new WirelessAlertTriggeredEvent(makeAlertTriggeredProps());

      expect(event.aggregateId).toBeInstanceOf(SnapshotId);
      expect(event.aggregateId).toBeInstanceOf(UniqueEntityID);
    });
  });

  describe('alerts getter', () => {
    it('should return the same array reference passed in props', () => {
      const alerts: ReadonlyArray<WirelessAlert> = [makeAlert()];
      const event = new WirelessAlertTriggeredEvent(
        makeAlertTriggeredProps({ alerts })
      );

      expect(event.alerts).toBe(alerts);
    });

    it('should expose alert properties when a single alert is present', () => {
      const alert = makeAlert({ metric: 'ccq', severity: 'CRITICAL', currentValue: 40 });
      const event = new WirelessAlertTriggeredEvent(
        makeAlertTriggeredProps({ alerts: [alert] })
      );

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
      const event = new WirelessAlertTriggeredEvent(
        makeAlertTriggeredProps({ alerts })
      );

      expect(event.alerts).toHaveLength(3);
    });
  });

  describe('toString()', () => {
    it('should include the event class name', () => {
      const event = new WirelessAlertTriggeredEvent(makeAlertTriggeredProps());

      expect(event.toString()).toContain('WirelessAlertTriggeredEvent');
    });

    it('should include the aggregate ID string value', () => {
      const aggregateId = SnapshotId.create();
      const event = new WirelessAlertTriggeredEvent(
        makeAlertTriggeredProps({ aggregateId })
      );

      expect(event.toString()).toContain(aggregateId.toString());
    });

    it('should include the ISO timestamp of dateTimeOccurred', () => {
      const event = new WirelessAlertTriggeredEvent(
        makeAlertTriggeredProps({ dateTimeOccurred: FIXED_OCCURRED })
      );

      expect(event.toString()).toContain(FIXED_OCCURRED.toISOString());
    });
  });
});

// ---------------------------------------------------------------------------

describe('WirelessAlertClearedEvent', () => {
  describe('constructor', () => {
    it('should create an event with all props accessible via getters', () => {
      const props = makeAlertClearedProps();
      const event = new WirelessAlertClearedEvent(props);

      expect(event.aggregateId).toBe(props.aggregateId);
      expect(event.deviceId).toBe(props.deviceId);
      expect(event.metric).toBe('signalRxDbm');
      expect(event.severity).toBe('WARNING');
      expect(event.clearedAt).toBe(FIXED_CLEARED);
      expect(event.dateTimeOccurred).toBe(FIXED_OCCURRED);
    });

    it('should freeze props to prevent external mutation', () => {
      const event = new WirelessAlertClearedEvent(makeAlertClearedProps());

      expect(
        Object.isFrozen((event as unknown as { props: unknown }).props)
      ).toBe(true);
    });

    it('should isolate event state from external mutation of the original props object', () => {
      const props = makeAlertClearedProps({ metric: 'ccq' });
      const event = new WirelessAlertClearedEvent(props);

      (props as { metric: string }).metric = 'noiseFloor';

      expect(event.metric).toBe('ccq');
    });
  });

  describe('instanceof checks', () => {
    it('should be an instance of DomainEvent', () => {
      const event = new WirelessAlertClearedEvent(makeAlertClearedProps());

      expect(event).toBeInstanceOf(DomainEvent);
    });

    it('should have an aggregateId that is an instance of WirelessAlertRecordId', () => {
      const event = new WirelessAlertClearedEvent(makeAlertClearedProps());

      expect(event.aggregateId).toBeInstanceOf(WirelessAlertRecordId);
      expect(event.aggregateId).toBeInstanceOf(UniqueEntityID);
    });
  });

  describe('severity getter', () => {
    it('should return WARNING when constructed with WARNING', () => {
      const event = new WirelessAlertClearedEvent(
        makeAlertClearedProps({ severity: 'WARNING' })
      );

      expect(event.severity).toBe('WARNING');
    });

    it('should return CRITICAL when constructed with CRITICAL', () => {
      const event = new WirelessAlertClearedEvent(
        makeAlertClearedProps({ severity: 'CRITICAL' })
      );

      expect(event.severity).toBe('CRITICAL');
    });
  });

  describe('temporal getters', () => {
    it('should return clearedAt and dateTimeOccurred as independent dates', () => {
      const event = new WirelessAlertClearedEvent(
        makeAlertClearedProps({ clearedAt: FIXED_CLEARED, dateTimeOccurred: FIXED_OCCURRED })
      );

      expect(event.clearedAt).not.toBe(event.dateTimeOccurred);
      expect(event.clearedAt).toBe(FIXED_CLEARED);
      expect(event.dateTimeOccurred).toBe(FIXED_OCCURRED);
    });
  });

  describe('toString()', () => {
    it('should include the event class name', () => {
      const event = new WirelessAlertClearedEvent(makeAlertClearedProps());

      expect(event.toString()).toContain('WirelessAlertClearedEvent');
    });

    it('should include the aggregate ID string value', () => {
      const aggregateId = WirelessAlertRecordId.create();
      const event = new WirelessAlertClearedEvent(
        makeAlertClearedProps({ aggregateId })
      );

      expect(event.toString()).toContain(aggregateId.toString());
    });

    it('should include the ISO timestamp of dateTimeOccurred', () => {
      const event = new WirelessAlertClearedEvent(
        makeAlertClearedProps({ dateTimeOccurred: FIXED_OCCURRED })
      );

      expect(event.toString()).toContain(FIXED_OCCURRED.toISOString());
    });
  });
});
