// Source: src/domain/device-monitoring/entities/PollingConfiguration.ts

import { PollingConfiguration } from '../../../../src/domain/device-monitoring/entities/PollingConfiguration';
import { PollingConfigurationId } from '../../../../src/domain/shared/ids/PollingConfigurationId';
import { DeviceId } from '../../../../src/domain/shared/ids/DeviceId';
import { IPAddress } from '../../../../src/domain/shared/value-objects/IPAddress';
import { PollingInterval } from '../../../../src/domain/device-monitoring/value-objects/PollingInterval';
import { FailureThreshold } from '../../../../src/domain/device-monitoring/value-objects/FailureThreshold';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const VALID_DEVICE_UUID = '550e8400-e29b-41d4-a716-446655440001';
const VALID_CONFIG_UUID = '550e8400-e29b-41d4-a716-446655440002';
const TEST_IP = '192.168.1.100';

function makeDeviceId(): DeviceId {
  return DeviceId.parse(VALID_DEVICE_UUID).value;
}

function makeIPAddress(ip = TEST_IP): IPAddress {
  return IPAddress.reconstitute(ip);
}

function makeConfigId(): PollingConfigurationId {
  return PollingConfigurationId.parse(VALID_CONFIG_UUID).value;
}

function makeInterval(seconds = 60): PollingInterval {
  return PollingInterval.create(seconds).value;
}

function makeThreshold(count = 3): FailureThreshold {
  return FailureThreshold.create(count).value;
}

function makeConfig(
  overrides: {
    ipAddress?: string | null;
    enabled?: boolean;
    intervalSeconds?: number;
    thresholdCount?: number;
  } = {}
): PollingConfiguration {
  const rawIp = overrides.ipAddress !== undefined ? overrides.ipAddress : TEST_IP;
  return PollingConfiguration.create(
    {
      deviceId: makeDeviceId(),
      ipAddress: rawIp !== null ? IPAddress.reconstitute(rawIp) : null,
      interval: makeInterval(overrides.intervalSeconds ?? 60),
      failuresBeforeDown: makeThreshold(overrides.thresholdCount ?? 3),
      enabled: overrides.enabled !== undefined ? overrides.enabled : true
    },
    makeConfigId()
  ).value;
}

// ---------------------------------------------------------------------------

describe('PollingConfiguration', () => {
  // ===========================================================================
  describe('create()', () => {
    it('should succeed with all required props provided', () => {
      const result = PollingConfiguration.create(
        {
          deviceId: makeDeviceId(),
          ipAddress: makeIPAddress(),
          interval: makeInterval(),
          failuresBeforeDown: makeThreshold(),
          enabled: true
        },
        makeConfigId()
      );

      expect(result.isSuccess).toBe(true);
    });

    it('should return a PollingConfiguration instance on success', () => {
      const result = PollingConfiguration.create(
        {
          deviceId: makeDeviceId(),
          ipAddress: makeIPAddress(),
          interval: makeInterval(),
          failuresBeforeDown: makeThreshold(),
          enabled: true
        },
        makeConfigId()
      );

      expect(result.value).toBeInstanceOf(PollingConfiguration);
    });

    it('should preserve the supplied ID', () => {
      const configId = makeConfigId();
      const result = PollingConfiguration.create(
        {
          deviceId: makeDeviceId(),
          ipAddress: makeIPAddress(),
          interval: makeInterval(),
          failuresBeforeDown: makeThreshold(),
          enabled: true
        },
        configId
      );

      expect(result.value.id.toString()).toBe(VALID_CONFIG_UUID);
    });

    it('should allow a null ipAddress', () => {
      const result = PollingConfiguration.create(
        {
          deviceId: makeDeviceId(),
          ipAddress: null,
          interval: makeInterval(),
          failuresBeforeDown: makeThreshold(),
          enabled: true
        },
        makeConfigId()
      );

      expect(result.isSuccess).toBe(true);
      expect(result.value.ipAddress).toBeNull();
    });

    it('should fail when deviceId is null', () => {
      const result = PollingConfiguration.create(
        {
          deviceId: null as unknown as DeviceId,
          ipAddress: makeIPAddress(),
          interval: makeInterval(),
          failuresBeforeDown: makeThreshold(),
          enabled: true
        },
        makeConfigId()
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('deviceId');
    });

    it('should fail when interval is null', () => {
      const result = PollingConfiguration.create(
        {
          deviceId: makeDeviceId(),
          ipAddress: makeIPAddress(),
          interval: null as unknown as PollingInterval,
          failuresBeforeDown: makeThreshold(),
          enabled: true
        },
        makeConfigId()
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('interval');
    });

    it('should fail when failuresBeforeDown is null', () => {
      const result = PollingConfiguration.create(
        {
          deviceId: makeDeviceId(),
          ipAddress: makeIPAddress(),
          interval: makeInterval(),
          failuresBeforeDown: null as unknown as FailureThreshold,
          enabled: true
        },
        makeConfigId()
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('failuresBeforeDown');
    });
  });

  // ===========================================================================
  describe('reconstitute()', () => {
    it('should build a PollingConfiguration directly without Result wrapping', () => {
      const config = PollingConfiguration.reconstitute(
        {
          deviceId: makeDeviceId(),
          ipAddress: makeIPAddress(),
          interval: makeInterval(),
          failuresBeforeDown: makeThreshold(),
          enabled: true
        },
        makeConfigId()
      );

      expect(config).toBeInstanceOf(PollingConfiguration);
    });

    it('should preserve all props during reconstitution', () => {
      const deviceId = makeDeviceId();
      const interval = makeInterval(300);
      const threshold = makeThreshold(5);

      const config = PollingConfiguration.reconstitute(
        {
          deviceId,
          ipAddress: makeIPAddress(),
          interval,
          failuresBeforeDown: threshold,
          enabled: false
        },
        makeConfigId()
      );

      expect(config.deviceId).toBe(deviceId);
      expect(config.interval).toBe(interval);
      expect(config.failuresBeforeDown).toBe(threshold);
      expect(config.enabled).toBe(false);
    });
  });

  // ===========================================================================
  describe('getters', () => {
    it('should expose deviceId', () => {
      const config = makeConfig();

      expect(config.deviceId.toString()).toBe(VALID_DEVICE_UUID);
    });

    it('should expose ipAddress', () => {
      const config = makeConfig({ ipAddress: TEST_IP });

      expect(config.ipAddress?.value).toBe(TEST_IP);
    });

    it('should expose null ipAddress when none is set', () => {
      const config = makeConfig({ ipAddress: null });

      expect(config.ipAddress).toBeNull();
    });

    it('should expose interval', () => {
      const config = makeConfig({ intervalSeconds: 120 });

      expect(config.interval.seconds).toBe(120);
    });

    it('should expose failuresBeforeDown', () => {
      const config = makeConfig({ thresholdCount: 5 });

      expect(config.failuresBeforeDown.value).toBe(5);
    });

    it('should expose enabled as true', () => {
      const config = makeConfig({ enabled: true });

      expect(config.enabled).toBe(true);
    });

    it('should expose enabled as false', () => {
      const config = makeConfig({ enabled: false });

      expect(config.enabled).toBe(false);
    });
  });

  // ===========================================================================
  describe('updateInterval()', () => {
    it('should update the polling interval to the new value', () => {
      const config = makeConfig({ intervalSeconds: 60 });
      const newInterval = makeInterval(300);

      const result = config.updateInterval(newInterval);

      expect(result.isSuccess).toBe(true);
      expect(config.interval.seconds).toBe(300);
    });

    it('should return a successful Result on a valid update', () => {
      const config = makeConfig();

      const result = config.updateInterval(makeInterval(120));

      expect(result.isSuccess).toBe(true);
    });

    it('should fail when null is passed as the new interval', () => {
      const config = makeConfig();

      const result = config.updateInterval(null as unknown as PollingInterval);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('interval');
    });

    it('should replace an existing interval with the new one', () => {
      const config = makeConfig({ intervalSeconds: 60 });
      const first = makeInterval(120);
      const second = makeInterval(600);

      config.updateInterval(first);
      config.updateInterval(second);

      expect(config.interval.seconds).toBe(600);
    });
  });

  // ===========================================================================
  describe('updateFailureThreshold()', () => {
    it('should update the failure threshold to the new value', () => {
      const config = makeConfig({ thresholdCount: 3 });
      const newThreshold = makeThreshold(10);

      const result = config.updateFailureThreshold(newThreshold);

      expect(result.isSuccess).toBe(true);
      expect(config.failuresBeforeDown.value).toBe(10);
    });

    it('should return a successful Result on a valid update', () => {
      const config = makeConfig();

      const result = config.updateFailureThreshold(makeThreshold(5));

      expect(result.isSuccess).toBe(true);
    });

    it('should fail when null is passed as the new threshold', () => {
      const config = makeConfig();

      const result = config.updateFailureThreshold(
        null as unknown as FailureThreshold
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('failuresBeforeDown');
    });
  });

  // ===========================================================================
  describe('updateIpAddress()', () => {
    it('should update the IP address to a new value', () => {
      const config = makeConfig({ ipAddress: '10.0.0.1' });

      config.updateIpAddress(makeIPAddress('10.0.0.2'));

      expect(config.ipAddress?.value).toBe('10.0.0.2');
    });

    it('should allow setting the IP address to null', () => {
      const config = makeConfig({ ipAddress: TEST_IP });

      config.updateIpAddress(null);

      expect(config.ipAddress).toBeNull();
    });

    it('should allow clearing and re-setting the IP address', () => {
      const config = makeConfig({ ipAddress: TEST_IP });

      config.updateIpAddress(null);
      config.updateIpAddress(makeIPAddress('172.16.0.1'));

      expect(config.ipAddress?.value).toBe('172.16.0.1');
    });
  });

  // ===========================================================================
  describe('enable()', () => {
    it('should set enabled to true on a disabled config', () => {
      const config = makeConfig({ enabled: false });

      config.enable();

      expect(config.enabled).toBe(true);
    });

    it('should return a successful Result', () => {
      const config = makeConfig({ enabled: false });

      const result = config.enable();

      expect(result.isSuccess).toBe(true);
    });

    it('should remain enabled when enable is called on an already-enabled config', () => {
      const config = makeConfig({ enabled: true });

      config.enable();

      expect(config.enabled).toBe(true);
    });

    it('should return a successful Result even when already enabled', () => {
      const config = makeConfig({ enabled: true });

      const result = config.enable();

      expect(result.isSuccess).toBe(true);
    });
  });

  // ===========================================================================
  describe('disable()', () => {
    it('should set enabled to false on an enabled config', () => {
      const config = makeConfig({ enabled: true });

      config.disable();

      expect(config.enabled).toBe(false);
    });

    it('should return a successful Result', () => {
      const config = makeConfig({ enabled: true });

      const result = config.disable();

      expect(result.isSuccess).toBe(true);
    });

    it('should remain disabled when disable is called on an already-disabled config', () => {
      const config = makeConfig({ enabled: false });

      config.disable();

      expect(config.enabled).toBe(false);
    });

    it('should return a successful Result even when already disabled', () => {
      const config = makeConfig({ enabled: false });

      const result = config.disable();

      expect(result.isSuccess).toBe(true);
    });
  });

  // ===========================================================================
  describe('enable() / disable() toggle cycle', () => {
    it('should toggle from enabled to disabled and back', () => {
      const config = makeConfig({ enabled: true });

      config.disable();
      expect(config.enabled).toBe(false);

      config.enable();
      expect(config.enabled).toBe(true);
    });
  });

  // ===========================================================================
  describe('equals()', () => {
    it('should return true for two configs created from the same ID', () => {
      const id = makeConfigId();
      const propsA = {
        deviceId: makeDeviceId(),
        ipAddress: makeIPAddress(),
        interval: makeInterval(),
        failuresBeforeDown: makeThreshold(),
        enabled: true
      };
      const propsB = {
        deviceId: makeDeviceId(),
        ipAddress: makeIPAddress('10.0.0.1'),
        interval: makeInterval(300),
        failuresBeforeDown: makeThreshold(5),
        enabled: false
      };

      const configA = PollingConfiguration.create(propsA, id).value;
      const configB = PollingConfiguration.create(propsB, id).value;

      expect(configA.equals(configB)).toBe(true);
    });

    it('should return false for two configs with different IDs', () => {
      const configA = makeConfig();
      const configB = PollingConfiguration.create(
        {
          deviceId: makeDeviceId(),
          ipAddress: makeIPAddress(),
          interval: makeInterval(),
          failuresBeforeDown: makeThreshold(),
          enabled: true
        },
        PollingConfigurationId.create()
      ).value;

      expect(configA.equals(configB)).toBe(false);
    });
  });
});
