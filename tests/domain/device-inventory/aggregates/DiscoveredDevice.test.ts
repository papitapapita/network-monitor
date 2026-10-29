// Source: src/domain/device-inventory/aggregates/DiscoveredDevice.ts

import { DiscoveredDevice } from '../../../../src/domain/device-inventory/aggregates';
import { DiscoverySource } from '../../../../src/domain/device-inventory/enums';
import { DeviceSighting } from '../../../../src/domain/device-inventory/props';

const T0 = new Date('2026-11-01T10:00:00Z');
const T1 = new Date('2026-11-01T11:00:00Z');
const AP_ID = '0b9c6f0e-3f4a-4c55-9a51-6f7d2a1c8e10';

function stationSighting(
  overrides: Partial<DeviceSighting> = {}
): DeviceSighting {
  return makeSighting({
    source: DiscoverySource.AP_STATION,
    segment: null,
    hostname: 'Cliente Perez',
    model: 'LiteBeam 5AC Gen2',
    accessPointId: AP_ID,
    ...overrides
  });
}

function makeSighting(
  overrides: Partial<DeviceSighting> = {}
): DeviceSighting {
  return {
    macAddress: 'aa-bb-cc-dd-ee-01',
    ipAddress: '192.168.1.20',
    manufacturer: 'Ubiquiti Inc',
    source: DiscoverySource.SCAN,
    segment: '192.168.1.0/24',
    hostname: null,
    model: null,
    accessPointId: null,
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
      expect(result.error).toBe(
        'source must be SCAN, AP_STATION, ROUTER_NEIGHBOR or ROUTER_ARP'
      );
    });
  });

  describe('[DEV-208] a station seen on an AP', () => {
    it('keeps the radio name, model and AP', () => {
      const device = DiscoveredDevice.create(stationSighting()).value;

      expect(device.source).toBe(DiscoverySource.AP_STATION);
      expect(device.hostname).toBe('Cliente Perez');
      expect(device.model).toBe('LiteBeam 5AC Gen2');
      expect(device.accessPointId).toBe(AP_ID);
      expect(device.segment).toBeNull();
    });

    it('cuts a radio name longer than 100 characters', () => {
      const device = DiscoveredDevice.create(
        stationSighting({ hostname: `  ${'x'.repeat(120)}  ` })
      ).value;

      expect(device.hostname).toBe('x'.repeat(100));
    });

    it('turns a blank radio name into null', () => {
      const device = DiscoveredDevice.create(
        stationSighting({ hostname: '   ' })
      ).value;

      expect(device.hostname).toBeNull();
    });

    it('refuses an AP id that is not a device id', () => {
      const result = DiscoveredDevice.create(
        stationSighting({ accessPointId: 'ap-1' })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('accessPointId must be a device id');
    });
  });

  describe('[DEV-202] sighted', () => {
    it('keeps the AP, radio name and model when a scan sees it', () => {
      const device = DiscoveredDevice.create(stationSighting()).value;

      device.sighted(makeSighting({ seenAt: T1 }));

      expect(device.source).toBe(DiscoverySource.SCAN);
      expect(device.segment).toBe('192.168.1.0/24');
      expect(device.accessPointId).toBe(AP_ID);
      expect(device.hostname).toBe('Cliente Perez');
      expect(device.model).toBe('LiteBeam 5AC Gen2');
    });

    it('keeps the segment when an AP sees it', () => {
      const device = makeDevice();

      device.sighted(stationSighting({ seenAt: T1 }));

      expect(device.source).toBe(DiscoverySource.AP_STATION);
      expect(device.segment).toBe('192.168.1.0/24');
      expect(device.accessPointId).toBe(AP_ID);
    });

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
