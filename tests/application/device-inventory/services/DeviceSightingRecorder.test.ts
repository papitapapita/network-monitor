// Source: src/application/device-inventory/services/DeviceSightingRecorder.ts

import {
  DeviceSightingRecorder,
  SightedHost,
  SightingBatch
} from '../../../../src/application/device-inventory/services';
import {
  IDiscoveryNotifier,
  IKnownDeviceLookup,
  KnownDeviceOwners
} from '../../../../src/application/device-inventory/interfaces';
import { IDiscoveredDeviceRepository } from '../../../../src/domain/device-inventory/repository';
import { DiscoveredDevice } from '../../../../src/domain/device-inventory/aggregates';
import { DiscoverySource } from '../../../../src/domain/device-inventory/enums';
import { Result } from '../../../../src/domain/shared/core';

const T0 = new Date('2026-11-01T10:00:00Z');
const T1 = new Date('2026-11-01T11:00:00Z');

function makeHost(overrides: Partial<SightedHost> = {}): SightedHost {
  return {
    macAddress: 'AA:BB:CC:DD:EE:01',
    ipAddress: '192.168.1.20',
    manufacturer: 'Ubiquiti Inc',
    ...overrides
  };
}

function makeBatch(hosts: SightedHost[]): SightingBatch {
  return {
    source: DiscoverySource.SCAN,
    segment: '192.168.1.0/24',
    where: '192.168.1.0/24',
    seenAt: T1,
    hosts
  };
}

function makeExisting(mac: string): DiscoveredDevice {
  return DiscoveredDevice.create({
    macAddress: mac,
    ipAddress: '192.168.1.99',
    manufacturer: null,
    source: DiscoverySource.SCAN,
    segment: '192.168.1.0/24',
    seenAt: T0
  }).value;
}

function owners(
  byMac: Record<string, string> = {},
  byIp: Record<string, string> = {}
): KnownDeviceOwners {
  return {
    byMac: new Map(Object.entries(byMac)),
    byIp: new Map(Object.entries(byIp))
  };
}

describe('DeviceSightingRecorder', () => {
  let repository: jest.Mocked<IDiscoveredDeviceRepository>;
  let lookup: jest.Mocked<IKnownDeviceLookup>;
  let notifier: jest.Mocked<IDiscoveryNotifier>;
  let recorder: DeviceSightingRecorder;

  beforeEach(() => {
    repository = {
      findById: jest.fn(),
      findByMacs: jest.fn().mockResolvedValue(Result.ok([])),
      saveMany: jest.fn().mockResolvedValue(Result.ok()),
      save: jest.fn(),
      deleteByMacs: jest.fn().mockResolvedValue(Result.ok(0)),
      deletePendingLastSeenBefore: jest.fn()
    };
    lookup = {
      findOwners: jest.fn().mockResolvedValue(Result.ok(owners()))
    };
    notifier = {
      newDevicesFound: jest.fn().mockResolvedValue(undefined)
    };
    recorder = new DeviceSightingRecorder(
      repository,
      lookup,
      notifier
    );
  });

  describe('[DEV-200] a MAC inventory lacks', () => {
    it('becomes a new suggestion', async () => {
      const result = await recorder.record(makeBatch([makeHost()]));

      expect(result.value[0]).toEqual({
        knownDeviceId: null,
        discoveredDeviceId: expect.any(String),
        isNew: true
      });
      const saved = repository.saveMany.mock.calls[0][0];
      expect(saved).toHaveLength(1);
      expect(saved[0].macAddress).toBe('AA:BB:CC:DD:EE:01');
      expect(saved[0].lastSeenAt).toEqual(T1);
    });

    it('matches inventory on the normalized MAC', async () => {
      await recorder.record(
        makeBatch([makeHost({ macAddress: 'aa-bb-cc-dd-ee-01' })])
      );

      expect(lookup.findOwners).toHaveBeenCalledWith(
        ['AA:BB:CC:DD:EE:01'],
        ['192.168.1.20']
      );
    });

    it('a host with no MAC is never stored', async () => {
      const result = await recorder.record(
        makeBatch([makeHost({ macAddress: null })])
      );

      expect(result.value[0]).toEqual({
        knownDeviceId: null,
        discoveredDeviceId: null,
        isNew: false
      });
      expect(repository.saveMany).toHaveBeenCalledWith([]);
      expect(notifier.newDevicesFound).not.toHaveBeenCalled();
    });

    it('a host with an unreadable MAC is treated as having none', async () => {
      const result = await recorder.record(
        makeBatch([makeHost({ macAddress: 'garbage' })])
      );

      expect(result.value[0].discoveredDeviceId).toBeNull();
    });
  });

  describe('[DEV-201] a host inventory has', () => {
    it('is matched by MAC', async () => {
      lookup.findOwners.mockResolvedValue(
        Result.ok(owners({ 'AA:BB:CC:DD:EE:01': 'dev-1' }))
      );

      const result = await recorder.record(makeBatch([makeHost()]));

      expect(result.value[0]).toEqual({
        knownDeviceId: 'dev-1',
        discoveredDeviceId: null,
        isNew: false
      });
      expect(repository.saveMany).toHaveBeenCalledWith([]);
    });

    it('is matched by IP when the MAC is unknown to inventory', async () => {
      lookup.findOwners.mockResolvedValue(
        Result.ok(owners({}, { '192.168.1.20': 'dev-2' }))
      );

      const result = await recorder.record(makeBatch([makeHost()]));

      expect(result.value[0].knownDeviceId).toBe('dev-2');
      expect(result.value[0].discoveredDeviceId).toBeNull();
    });

    it('is matched by IP when it has no MAC', async () => {
      lookup.findOwners.mockResolvedValue(
        Result.ok(owners({}, { '192.168.1.20': 'dev-2' }))
      );

      const result = await recorder.record(
        makeBatch([makeHost({ macAddress: null })])
      );

      expect(result.value[0].knownDeviceId).toBe('dev-2');
    });
  });

  describe('[DEV-202] a MAC already suggested', () => {
    it('is refreshed, not new', async () => {
      const existing = makeExisting('AA:BB:CC:DD:EE:01');
      repository.findByMacs.mockResolvedValue(Result.ok([existing]));

      const result = await recorder.record(makeBatch([makeHost()]));

      expect(result.value[0]).toEqual({
        knownDeviceId: null,
        discoveredDeviceId: existing.id.toString(),
        isNew: false
      });
      expect(existing.ipAddress).toBe('192.168.1.20');
      expect(existing.lastSeenAt).toEqual(T1);
      expect(notifier.newDevicesFound).not.toHaveBeenCalled();
    });

    it('an ignored one is refreshed and stays ignored', async () => {
      const existing = makeExisting('AA:BB:CC:DD:EE:01');
      existing.ignore(T0);
      repository.findByMacs.mockResolvedValue(Result.ok([existing]));

      await recorder.record(makeBatch([makeHost()]));

      expect(existing.isIgnored).toBe(true);
      expect(existing.lastSeenAt).toEqual(T1);
    });
  });

  describe('[DEV-203] a MAC inventory now owns', () => {
    it('clears its suggestion', async () => {
      lookup.findOwners.mockResolvedValue(
        Result.ok(owners({ 'AA:BB:CC:DD:EE:01': 'dev-1' }))
      );

      await recorder.record(makeBatch([makeHost()]));

      expect(repository.deleteByMacs).toHaveBeenCalledWith([
        'AA:BB:CC:DD:EE:01'
      ]);
    });

    it('clears nothing when nothing is known', async () => {
      await recorder.record(makeBatch([makeHost()]));

      expect(repository.deleteByMacs).not.toHaveBeenCalled();
    });
  });

  describe('[DEV-206] the notice', () => {
    it('counts the new MACs once per batch', async () => {
      await recorder.record(
        makeBatch([
          makeHost({
            macAddress: 'AA:BB:CC:DD:EE:01',
            ipAddress: '10.0.0.1'
          }),
          makeHost({
            macAddress: 'AA:BB:CC:DD:EE:02',
            ipAddress: '10.0.0.2'
          })
        ])
      );

      expect(notifier.newDevicesFound).toHaveBeenCalledTimes(1);
      expect(notifier.newDevicesFound).toHaveBeenCalledWith({
        count: 2,
        where: '192.168.1.0/24',
        occurredAt: T1
      });
    });

    it('is not sent when nothing is new', async () => {
      repository.findByMacs.mockResolvedValue(
        Result.ok([makeExisting('AA:BB:CC:DD:EE:01')])
      );

      await recorder.record(makeBatch([makeHost()]));

      expect(notifier.newDevicesFound).not.toHaveBeenCalled();
    });
  });

  describe('[DEV-207] a MAC answering for several addresses', () => {
    it('matches and stores none of them by that MAC', async () => {
      lookup.findOwners.mockResolvedValue(
        Result.ok(owners({ 'AA:BB:CC:DD:EE:01': 'router' }))
      );

      const result = await recorder.record(
        makeBatch([
          makeHost({ ipAddress: '10.0.0.5' }),
          makeHost({ ipAddress: '10.0.0.6' })
        ])
      );

      expect(lookup.findOwners).toHaveBeenCalledWith(
        [],
        ['10.0.0.5', '10.0.0.6']
      );
      expect(result.value.map((o) => o.knownDeviceId)).toEqual([
        null,
        null
      ]);
      expect(repository.saveMany).toHaveBeenCalledWith([]);
    });

    it('the same MAC twice at the same address is still one host', async () => {
      const result = await recorder.record(
        makeBatch([makeHost(), makeHost()])
      );

      expect(result.value[0].isNew).toBe(true);
      expect(repository.saveMany.mock.calls[0][0]).toHaveLength(1);
    });
  });

  describe('failures', () => {
    it('fails when inventory cannot be read', async () => {
      lookup.findOwners.mockResolvedValue(Result.fail('db down'));

      const result = await recorder.record(makeBatch([makeHost()]));

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('db down');
      expect(repository.saveMany).not.toHaveBeenCalled();
    });

    it('fails and sends no notice when saving fails', async () => {
      repository.saveMany.mockResolvedValue(Result.fail('disk full'));

      const result = await recorder.record(makeBatch([makeHost()]));

      expect(result.isFailure).toBe(true);
      expect(notifier.newDevicesFound).not.toHaveBeenCalled();
    });
  });
});
