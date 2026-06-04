import { WirelessDeviceConfig } from '../../../../src/domain/wireless-monitoring/aggregates/WirelessDeviceConfig';
import { WirelessDeviceConfigToggledEvent } from '../../../../src/domain/wireless-monitoring/events/WirelessDeviceConfigToggled';
import { WirelessDeviceConfigProps } from '../../../../src/domain/wireless-monitoring/props/WirelessDeviceConfigProps';
import { WirelessDeviceConfigId } from '../../../../src/domain/shared/ids';
import { DeviceId } from '../../../../src/domain/shared/ids';
import { IPAddress, PollingInterval } from '../../../../src/domain/shared/value-objects';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeProps(
  overrides: Partial<WirelessDeviceConfigProps> = {}
): WirelessDeviceConfigProps {
  return {
    deviceId: DeviceId.create(),
    ipAddress: null,
    enabled: true,
    pollingInterval: PollingInterval.reconstitute(60),
    deviceType: 'STATION',
    linkCapacityBps: null,
    clientsProvisionedLimit: null,
    lastPolledAt: null,
    ...overrides,
  };
}

function makeConfig(
  overrides: Partial<WirelessDeviceConfigProps> = {}
): WirelessDeviceConfig {
  const result = WirelessDeviceConfig.create(makeProps(overrides));
  if (result.isFailure) {
    throw new Error(`makeConfig: ${result.error}`);
  }
  return result.value;
}

// ---------------------------------------------------------------------------
describe('WirelessDeviceConfig', () => {
  // =========================================================================
  describe('create()', () => {
    describe('when given valid minimal props', () => {
      it('should return a successful Result', () => {
        const result = WirelessDeviceConfig.create(makeProps());

        expect(result.isSuccess).toBe(true);
        expect(result.isFailure).toBe(false);
      });

      it('should return a WirelessDeviceConfig instance', () => {
        const result = WirelessDeviceConfig.create(makeProps());

        expect(result.value).toBeInstanceOf(WirelessDeviceConfig);
      });

      it('should auto-generate a WirelessDeviceConfigId when none is provided', () => {
        const config = makeConfig();

        expect(config.id).toBeInstanceOf(WirelessDeviceConfigId);
        expect(config.id.toValue().length).toBeGreaterThan(0);
      });

      it('should use the explicitly provided id', () => {
        const id = WirelessDeviceConfigId.create();
        const result = WirelessDeviceConfig.create(makeProps(), id);

        expect(result.isSuccess).toBe(true);
        expect(result.value.id).toBe(id);
      });

      it('should generate unique IDs for each created config', () => {
        const a = makeConfig();
        const b = makeConfig();

        expect(a.id.toString()).not.toBe(b.id.toString());
      });

      it('should expose the provided deviceId', () => {
        const deviceId = DeviceId.create();
        const config = makeConfig({ deviceId });

        expect(config.deviceId).toBe(deviceId);
      });

      it('should expose the provided deviceType', () => {
        const config = makeConfig({ deviceType: 'ACCESS_POINT' });

        expect(config.deviceType).toBe('ACCESS_POINT');
      });

      it('should expose the provided polling interval', () => {
        const pollingInterval = PollingInterval.reconstitute(120);
        const config = makeConfig({ pollingInterval });

        expect(config.pollingInterval.seconds).toBe(120);
      });

      it('should default optional fields to null when not provided', () => {
        const config = makeConfig({
          ipAddress: null,
          linkCapacityBps: null,
          clientsProvisionedLimit: null,
          lastPolledAt: null,
        });

        expect(config.ipAddress).toBeNull();
        expect(config.linkCapacityBps).toBeNull();
        expect(config.clientsProvisionedLimit).toBeNull();
        expect(config.lastPolledAt).toBeNull();
      });

      it('should emit NO domain events on creation', () => {
        const config = makeConfig();

        expect(config.domainEvents.length).toBe(0);
      });
    });

    // -----------------------------------------------------------------------
    describe('required field validation', () => {
      it('should fail when deviceId is null', () => {
        const result = WirelessDeviceConfig.create(
          makeProps({ deviceId: null as unknown as DeviceId })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('deviceId');
      });

      it('should fail when deviceId is undefined', () => {
        const result = WirelessDeviceConfig.create(
          makeProps({ deviceId: undefined as unknown as DeviceId })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('deviceId');
      });

      it('should fail when deviceType is null', () => {
        const result = WirelessDeviceConfig.create(
          makeProps({
            deviceType: null as unknown as 'STATION' | 'ACCESS_POINT',
          })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('deviceType');
      });

      it('should fail when deviceType is undefined', () => {
        const result = WirelessDeviceConfig.create(
          makeProps({
            deviceType: undefined as unknown as 'STATION' | 'ACCESS_POINT',
          })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('deviceType');
      });

      it('should fail when pollingInterval is null', () => {
        const result = WirelessDeviceConfig.create(
          makeProps({
            pollingInterval: null as unknown as PollingInterval,
          })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('pollingInterval');
      });
    });
  });

  // =========================================================================
  describe('reconstitute()', () => {
    it('should return a WirelessDeviceConfig instance', () => {
      const id = WirelessDeviceConfigId.create();
      const config = WirelessDeviceConfig.reconstitute(id, makeProps());

      expect(config).toBeInstanceOf(WirelessDeviceConfig);
    });

    it('should use the provided id', () => {
      const id = WirelessDeviceConfigId.create();
      const config = WirelessDeviceConfig.reconstitute(id, makeProps());

      expect(config.id).toBe(id);
    });

    it('should bypass validation and allow a zero-second interval', () => {
      const id = WirelessDeviceConfigId.create();
      // create() would reject pollingInterval: null, but reconstitute bypasses guards
      const config = WirelessDeviceConfig.reconstitute(
        id,
        makeProps({ pollingInterval: PollingInterval.reconstitute(0) })
      );

      expect(config).toBeInstanceOf(WirelessDeviceConfig);
      expect(config.pollingInterval.seconds).toBe(0);
    });

    it('should emit no domain events', () => {
      const id = WirelessDeviceConfigId.create();
      const config = WirelessDeviceConfig.reconstitute(id, makeProps());

      expect(config.domainEvents.length).toBe(0);
    });

    it('should expose all props it was given', () => {
      const id = WirelessDeviceConfigId.create();
      const deviceId = DeviceId.create();
      const ipAddress = IPAddress.create('10.0.0.1').value;
      const pollingInterval = PollingInterval.reconstitute(30);
      const lastPolledAt = new Date('2025-01-01T00:00:00Z');

      const config = WirelessDeviceConfig.reconstitute(id, {
        deviceId,
        ipAddress,
        enabled: false,
        pollingInterval,
        deviceType: 'ACCESS_POINT',
        linkCapacityBps: 1_000_000,
        clientsProvisionedLimit: 50,
        lastPolledAt,
      });

      expect(config.deviceId).toBe(deviceId);
      expect(config.ipAddress).toBe(ipAddress);
      expect(config.enabled).toBe(false);
      expect(config.pollingInterval.seconds).toBe(30);
      expect(config.deviceType).toBe('ACCESS_POINT');
      expect(config.linkCapacityBps).toBe(1_000_000);
      expect(config.clientsProvisionedLimit).toBe(50);
      expect(config.lastPolledAt).toEqual(lastPolledAt);
    });
  });

  // =========================================================================
  describe('isDue(now)', () => {
    describe('when the config is disabled', () => {
      it('should return false even when lastPolledAt is null', () => {
        const config = makeConfig({ enabled: false, lastPolledAt: null });

        expect(config.isDue(new Date())).toBe(false);
      });

      it('should return false even when the interval is long overdue', () => {
        const longAgo = new Date(Date.now() - 999_999_000);
        const config = makeConfig({ enabled: false, lastPolledAt: longAgo });

        expect(config.isDue(new Date())).toBe(false);
      });
    });

    describe('when the config is enabled', () => {
      it('should return true when lastPolledAt is null (never polled)', () => {
        const config = makeConfig({ enabled: true, lastPolledAt: null });

        expect(config.isDue(new Date())).toBe(true);
      });

      it('should return false when the interval has not yet elapsed', () => {
        const now = new Date('2025-01-01T00:01:00Z');
        // polled 10 seconds ago, interval is 60 seconds → not due
        const lastPolledAt = new Date('2025-01-01T00:00:50Z');
        const config = makeConfig({
          enabled: true,
          pollingInterval: PollingInterval.reconstitute(60),
          lastPolledAt,
        });

        expect(config.isDue(now)).toBe(false);
      });

      it('should return true when exactly at the boundary (lastPolledAt + interval === now)', () => {
        const base = new Date('2025-01-01T00:00:00Z');
        const now = new Date(base.getTime() + 60_000); // exactly 60 s later
        const config = makeConfig({
          enabled: true,
          pollingInterval: PollingInterval.reconstitute(60),
          lastPolledAt: base,
        });

        expect(config.isDue(now)).toBe(true);
      });

      it('should return true when the interval has been exceeded (overdue)', () => {
        const base = new Date('2025-01-01T00:00:00Z');
        const now = new Date(base.getTime() + 120_000); // 120 s after, interval = 60
        const config = makeConfig({
          enabled: true,
          pollingInterval: PollingInterval.reconstitute(60),
          lastPolledAt: base,
        });

        expect(config.isDue(now)).toBe(true);
      });

      it('should return false when now is before the next due time by 1 ms', () => {
        const base = new Date('2025-01-01T00:00:00Z');
        const now = new Date(base.getTime() + 59_999); // 1 ms short of due
        const config = makeConfig({
          enabled: true,
          pollingInterval: PollingInterval.reconstitute(60),
          lastPolledAt: base,
        });

        expect(config.isDue(now)).toBe(false);
      });
    });
  });

  // =========================================================================
  describe('markPolled(at)', () => {
    it('should return a successful Result', () => {
      const config = makeConfig();
      const result = config.markPolled(new Date());

      expect(result.isSuccess).toBe(true);
    });

    it('should update lastPolledAt to the provided date', () => {
      const config = makeConfig({ lastPolledAt: null });
      const polledAt = new Date('2025-06-01T12:00:00Z');
      config.markPolled(polledAt);

      expect(config.lastPolledAt).toEqual(polledAt);
    });

    it('should overwrite a previously set lastPolledAt', () => {
      const first = new Date('2025-01-01T00:00:00Z');
      const second = new Date('2025-01-01T01:00:00Z');
      const config = makeConfig({ lastPolledAt: first });
      config.markPolled(second);

      expect(config.lastPolledAt).toEqual(second);
    });

    it('should emit no domain events', () => {
      const config = makeConfig();
      config.markPolled(new Date());

      expect(config.domainEvents.length).toBe(0);
    });
  });

  // =========================================================================
  describe('enable()', () => {
    describe('when the config is already enabled', () => {
      it('should return a successful Result', () => {
        const config = makeConfig({ enabled: true });
        const result = config.enable();

        expect(result.isSuccess).toBe(true);
      });

      it('should leave enabled as true', () => {
        const config = makeConfig({ enabled: true });
        config.enable();

        expect(config.enabled).toBe(true);
      });

      it('should emit no domain events', () => {
        const config = makeConfig({ enabled: true });
        config.enable();

        expect(config.domainEvents.length).toBe(0);
      });
    });

    describe('when the config is disabled', () => {
      it('should return a successful Result', () => {
        const config = makeConfig({ enabled: false });
        const result = config.enable();

        expect(result.isSuccess).toBe(true);
      });

      it('should set enabled to true', () => {
        const config = makeConfig({ enabled: false });
        config.enable();

        expect(config.enabled).toBe(true);
      });

      it('should emit exactly one domain event', () => {
        const config = makeConfig({ enabled: false });
        config.enable();

        expect(config.domainEvents.length).toBe(1);
      });

      it('should emit a WirelessDeviceConfigToggledEvent', () => {
        const config = makeConfig({ enabled: false });
        config.enable();

        expect(config.domainEvents[0]).toBeInstanceOf(
          WirelessDeviceConfigToggledEvent
        );
      });

      it('should emit an event with enabled = true', () => {
        const config = makeConfig({ enabled: false });
        config.enable();

        const event = config.domainEvents[0] as WirelessDeviceConfigToggledEvent;

        expect(event.enabled).toBe(true);
      });

      it('should emit an event referencing the correct aggregateId', () => {
        const config = makeConfig({ enabled: false });
        config.enable();

        const event = config.domainEvents[0] as WirelessDeviceConfigToggledEvent;

        expect(event.aggregateId.toString()).toBe(config.id.toString());
      });

      it('should emit an event referencing the correct deviceId', () => {
        const deviceId = DeviceId.create();
        const config = makeConfig({ enabled: false, deviceId });
        config.enable();

        const event = config.domainEvents[0] as WirelessDeviceConfigToggledEvent;

        expect(event.deviceId.toString()).toBe(deviceId.toString());
      });

      it('should emit an event with a recent dateTimeOccurred', () => {
        const before = new Date();
        const config = makeConfig({ enabled: false });
        config.enable();
        const after = new Date();

        const event = config.domainEvents[0] as WirelessDeviceConfigToggledEvent;

        expect(event.dateTimeOccurred.getTime()).toBeGreaterThanOrEqual(
          before.getTime()
        );
        expect(event.dateTimeOccurred.getTime()).toBeLessThanOrEqual(
          after.getTime()
        );
      });
    });
  });

  // =========================================================================
  describe('disable()', () => {
    describe('when the config is already disabled', () => {
      it('should return a successful Result', () => {
        const config = makeConfig({ enabled: false });
        const result = config.disable();

        expect(result.isSuccess).toBe(true);
      });

      it('should leave enabled as false', () => {
        const config = makeConfig({ enabled: false });
        config.disable();

        expect(config.enabled).toBe(false);
      });

      it('should emit no domain events', () => {
        const config = makeConfig({ enabled: false });
        config.disable();

        expect(config.domainEvents.length).toBe(0);
      });
    });

    describe('when the config is enabled', () => {
      it('should return a successful Result', () => {
        const config = makeConfig({ enabled: true });
        const result = config.disable();

        expect(result.isSuccess).toBe(true);
      });

      it('should set enabled to false', () => {
        const config = makeConfig({ enabled: true });
        config.disable();

        expect(config.enabled).toBe(false);
      });

      it('should emit exactly one domain event', () => {
        const config = makeConfig({ enabled: true });
        config.disable();

        expect(config.domainEvents.length).toBe(1);
      });

      it('should emit a WirelessDeviceConfigToggledEvent', () => {
        const config = makeConfig({ enabled: true });
        config.disable();

        expect(config.domainEvents[0]).toBeInstanceOf(
          WirelessDeviceConfigToggledEvent
        );
      });

      it('should emit an event with enabled = false', () => {
        const config = makeConfig({ enabled: true });
        config.disable();

        const event = config.domainEvents[0] as WirelessDeviceConfigToggledEvent;

        expect(event.enabled).toBe(false);
      });

      it('should emit an event referencing the correct aggregateId', () => {
        const config = makeConfig({ enabled: true });
        config.disable();

        const event = config.domainEvents[0] as WirelessDeviceConfigToggledEvent;

        expect(event.aggregateId.toString()).toBe(config.id.toString());
      });

      it('should emit an event referencing the correct deviceId', () => {
        const deviceId = DeviceId.create();
        const config = makeConfig({ enabled: true, deviceId });
        config.disable();

        const event = config.domainEvents[0] as WirelessDeviceConfigToggledEvent;

        expect(event.deviceId.toString()).toBe(deviceId.toString());
      });

      it('should emit an event with a recent dateTimeOccurred', () => {
        const before = new Date();
        const config = makeConfig({ enabled: true });
        config.disable();
        const after = new Date();

        const event = config.domainEvents[0] as WirelessDeviceConfigToggledEvent;

        expect(event.dateTimeOccurred.getTime()).toBeGreaterThanOrEqual(
          before.getTime()
        );
        expect(event.dateTimeOccurred.getTime()).toBeLessThanOrEqual(
          after.getTime()
        );
      });
    });
  });

  // =========================================================================
  describe('updateIpAddress(ip)', () => {
    it('should set ipAddress to a valid IPAddress value object', () => {
      const config = makeConfig({ ipAddress: null });
      const ip = IPAddress.create('192.168.1.100').value;
      const result = config.updateIpAddress(ip);

      expect(result.isSuccess).toBe(true);
      expect(config.ipAddress).toBe(ip);
    });

    it('should overwrite an existing ipAddress with a new one', () => {
      const original = IPAddress.create('10.0.0.1').value;
      const updated = IPAddress.create('10.0.0.2').value;
      const config = makeConfig({ ipAddress: original });
      config.updateIpAddress(updated);

      expect(config.ipAddress).toBe(updated);
    });

    it('should set ipAddress to null', () => {
      const ip = IPAddress.create('10.0.0.1').value;
      const config = makeConfig({ ipAddress: ip });
      const result = config.updateIpAddress(null);

      expect(result.isSuccess).toBe(true);
      expect(config.ipAddress).toBeNull();
    });

    it('should emit no domain events', () => {
      const config = makeConfig();
      config.updateIpAddress(IPAddress.create('172.16.0.1').value);

      expect(config.domainEvents.length).toBe(0);
    });
  });

  // =========================================================================
  describe('equals()', () => {
    it('should return true for two configs sharing the same id', () => {
      const id = WirelessDeviceConfigId.create();
      const a = WirelessDeviceConfig.reconstitute(id, makeProps());
      const b = WirelessDeviceConfig.reconstitute(id, makeProps());

      expect(a.equals(b)).toBe(true);
    });

    it('should return true when compared to itself', () => {
      const config = makeConfig();

      expect(config.equals(config)).toBe(true);
    });

    it('should return false for two configs with different ids', () => {
      const a = makeConfig();
      const b = makeConfig();

      expect(a.equals(b)).toBe(false);
    });

    it('should return false when compared to undefined', () => {
      const config = makeConfig();

      expect(config.equals(undefined)).toBe(false);
    });
  });

  // =========================================================================
  describe('clearEvents()', () => {
    it('should remove all accumulated domain events', () => {
      const config = makeConfig({ enabled: false });
      config.enable();
      config.disable();
      expect(config.domainEvents.length).toBe(2);

      config.clearEvents();

      expect(config.domainEvents.length).toBe(0);
    });

    it('should allow new events to accumulate after clearing', () => {
      const config = makeConfig({ enabled: false });
      config.enable();
      config.clearEvents();

      config.disable();

      expect(config.domainEvents.length).toBe(1);
      expect(config.domainEvents[0]).toBeInstanceOf(
        WirelessDeviceConfigToggledEvent
      );
    });
  });
});
