// Source: src/domain/device-inventory/aggregates/DiscoveredDevice.ts

import { DiscoveredDevice } from '../../../../src/domain/device-inventory/aggregates';
import { DiscoverySource } from '../../../../src/domain/device-inventory/enums';
import { DeviceSighting } from '../../../../src/domain/device-inventory/props';

const T0 = new Date('2026-11-01T10:00:00Z');
const T1 = new Date('2026-11-01T11:00:00Z');

function makeSighting(
  overrides: Partial<DeviceSighting> = {}
): DeviceSighting {
  return {
    macAddress: 'aa-bb-cc-dd-ee-01',
    ipAddress: '192.168.1.20',
    manufacturer: 'Ubiquiti Inc',
    source: DiscoverySource.SCAN,
    segment: '192.168.1.0/24',
    seenAt: T0,
    ...overrides
  };
}

function makeDevice(
  overrides: Partial<DeviceSighting> = {}
): DiscoveredDevice {
  return DiscoveredDevice.create(makeSighting(overrides)).value;
}

describe('DiscoveredDevice', () => {
  describe('[DEV-200] create', () => {
    it('stores the MAC upper-case with colons', () => {
      expect(makeDevice().macAddress).toBe('AA:BB:CC:DD:EE:01');
    });

    it('starts pending, first and last seen at the sighting', () => {
      const device = makeDevice();

      expect(device.isIgnored).toBe(false);
      expect(device.firstSeenAt).toEqual(T0);
      expect(device.lastSeenAt).toEqual(T0);
    });

    it('keeps the IP, manufacturer, source and segment', () => {
      const device = makeDevice();

      expect(device.ipAddress).toBe('192.168.1.20');
      expect(device.manufacturer).toBe('Ubiquiti Inc');
      expect(device.source).toBe(DiscoverySource.SCAN);
      expect(device.segment).toBe('192.168.1.0/24');
    });

    it('turns a blank manufacturer into null', () => {
      expect(
        makeDevice({ manufacturer: '  ' }).manufacturer
      ).toBeNull();
    });

    it('refuses an invalid MAC', () => {
      const result = DiscoveredDevice.create(
        makeSighting({ macAddress: 'not-a-mac' })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid MAC address format');
    });

    it('refuses a missing MAC', () => {
      const result = DiscoveredDevice.create(
        makeSighting({ macAddress: undefined as unknown as string })
      );

      expect(result.isFailure).toBe(true);
    });

    it('refuses an invalid IP', () => {
      const result = DiscoveredDevice.create(
        makeSighting({ ipAddress: '999.1.1.1' })
      );

      expect(result.isFailure).toBe(true);
    });

    it('accepts a sighting with no IP', () => {
      expect(makeDevice({ ipAddress: null }).ipAddress).toBeNull();
    });

    it('refuses an unknown source', () => {
      const result = DiscoveredDevice.create(
        makeSighting({ source: 'DHCP' as DiscoverySource })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('source must be SCAN or AP_STATION');
    });
  });

  describe('[DEV-202] sighted', () => {
    it('refreshes the IP, segment and last seen', () => {
      const device = makeDevice();

      device.sighted(
        makeSighting({
          ipAddress: '192.168.2.9',
          segment: '192.168.2.0/24',
          seenAt: T1
        })
      );

      expect(device.ipAddress).toBe('192.168.2.9');
      expect(device.segment).toBe('192.168.2.0/24');
      expect(device.lastSeenAt).toEqual(T1);
      expect(device.firstSeenAt).toEqual(T0);
    });

    it('keeps the earlier manufacturer and IP when the new sighting lacks them', () => {
      const device = makeDevice();

      device.sighted(
        makeSighting({
          manufacturer: null,
          ipAddress: null,
          seenAt: T1
        })
      );

      expect(device.manufacturer).toBe('Ubiquiti Inc');
      expect(device.ipAddress).toBe('192.168.1.20');
    });

    it('ignores a sighting older than the last one', () => {
      const device = makeDevice({ seenAt: T1 });

      const result = device.sighted(
        makeSighting({ ipAddress: '10.0.0.1', seenAt: T0 })
      );

      expect(result.isSuccess).toBe(true);
      expect(device.ipAddress).toBe('192.168.1.20');
      expect(device.lastSeenAt).toEqual(T1);
    });

    it('refuses a sighting of another MAC', () => {
      const device = makeDevice();

      const result = device.sighted(
        makeSighting({ macAddress: 'AA:BB:CC:DD:EE:02', seenAt: T1 })
      );

      expect(result.isFailure).toBe(true);
    });

    it('stays ignored', () => {
      const device = makeDevice();
      device.ignore(T0);

      device.sighted(makeSighting({ seenAt: T1 }));

      expect(device.isIgnored).toBe(true);
    });
  });

  describe('[DEV-204] ignore and unignore', () => {
    it('records when it was ignored', () => {
      const device = makeDevice();

      device.ignore(T1);

      expect(device.isIgnored).toBe(true);
      expect(device.ignoredAt).toEqual(T1);
    });

    it('keeps the first ignore time', () => {
      const device = makeDevice();
      device.ignore(T0);

      device.ignore(T1);

      expect(device.ignoredAt).toEqual(T0);
    });

    it('unignore puts it back to pending', () => {
      const device = makeDevice();
      device.ignore(T0);

      device.unignore();

      expect(device.isIgnored).toBe(false);
      expect(device.ignoredAt).toBeNull();
    });
  });
});
