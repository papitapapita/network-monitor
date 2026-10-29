// Source: src/application/device-inventory/use-cases/RunScheduledDiscoveryUseCase.ts

import {
  RunScheduledDiscoveryUseCase,
  SCAN_NEEDS_SERVER_ON_SITE
} from '../../../../src/application/device-inventory/use-cases';
import {
  DiscoveredHost,
  IRouterHostQuery,
  IRouterNeighborQuery,
  ISegmentScanner
} from '../../../../src/application/device-inventory/interfaces';
import {
  DeviceSightingRecorder,
  SightingBatch
} from '../../../../src/application/device-inventory/services';
import { IDiscoverySettingsRepository } from '../../../../src/domain/device-inventory/repository';
import { DiscoverySettings } from '../../../../src/domain/device-inventory/value-objects';
import { DiscoverySegment } from '../../../../src/domain/device-inventory/props';
import { DiscoverySource } from '../../../../src/domain/device-inventory/enums';
import { Result } from '../../../../src/domain/shared/core';

const AGENT = '0b9c6f0e-3f4a-4c55-9a51-6f7d2a1c8e10';
const NOW = new Date('2026-11-03T12:00:00Z');
const HOUR = 3_600_000;

const HOST: DiscoveredHost = {
  ipAddress: '192.168.1.20',
  latencyMs: 3,
  macAddress: 'AA:BB:CC:DD:EE:01',
  manufacturer: 'Ubiquiti Inc'
};

function makeSettings(
  segments: DiscoverySegment[] = [
    { cidr: '192.168.1.0/24', agentId: null }
  ],
  overrides: { enabled?: boolean; intervalHours?: number } = {}
): DiscoverySettings {
  return DiscoverySettings.reconstitute({
    enabled: overrides.enabled ?? true,
    intervalHours: overrides.intervalHours ?? 24,
    segments
  });
}

describe('RunScheduledDiscoveryUseCase', () => {
  let repository: jest.Mocked<IDiscoverySettingsRepository>;
  let scanner: jest.Mocked<ISegmentScanner>;
  let recorder: jest.Mocked<DeviceSightingRecorder>;

  function makeUseCase(
    serverOnSite = true,
    routerNeighbors: IRouterNeighborQuery | null = null,
    routerHosts: IRouterHostQuery | null = null
  ): RunScheduledDiscoveryUseCase {
    return new RunScheduledDiscoveryUseCase(
      repository,
      scanner,
      recorder,
      serverOnSite,
      routerNeighbors,
      routerHosts
    );
  }

  beforeEach(() => {
    repository = {
      get: jest.fn().mockResolvedValue(Result.ok(makeSettings())),
      save: jest.fn(),
      lastRunAt: jest.fn().mockResolvedValue(Result.ok(null)),
      recordRun: jest.fn().mockResolvedValue(Result.ok())
    };
    scanner = {
      scan: jest.fn().mockResolvedValue(Result.ok([HOST]))
    };
    recorder = {
      record: jest.fn(async (batch: SightingBatch) =>
        Result.ok(
          batch.hosts.map(() => ({
            knownDeviceId: null,
            discoveredDeviceId: 'd-1',
            isNew: true
          }))
        )
      )
    } as unknown as jest.Mocked<DeviceSightingRecorder>;
  });

  describe('[DEV-211] when it runs', () => {
    it('runs on the first check after it is turned on', async () => {
      const result = await makeUseCase().execute({ now: NOW });

      expect(result.value.ran).toBe(true);
      expect(repository.recordRun).toHaveBeenCalledWith(NOW);
    });

    it('does not run while it is off', async () => {
      repository.get.mockResolvedValue(
        Result.ok(makeSettings(undefined, { enabled: false }))
      );

      const result = await makeUseCase().execute({ now: NOW });

      expect(result.value).toEqual({
        ran: false,
        segments: [],
        routers: [],
        arp: []
      });
      expect(scanner.scan).not.toHaveBeenCalled();
    });

    it('does not run with no segments', async () => {
      repository.get.mockResolvedValue(Result.ok(makeSettings([])));

      const result = await makeUseCase().execute({ now: NOW });

      expect(result.value.ran).toBe(false);
    });

    it('waits until the interval has passed since the last run', async () => {
      repository.lastRunAt.mockResolvedValue(
        Result.ok(new Date(NOW.getTime() - 24 * HOUR + 1))
      );

      const result = await makeUseCase().execute({ now: NOW });

      expect(result.value.ran).toBe(false);
      expect(repository.recordRun).not.toHaveBeenCalled();
    });

    it('runs once the interval has passed', async () => {
      repository.lastRunAt.mockResolvedValue(
        Result.ok(new Date(NOW.getTime() - 24 * HOUR))
      );

      const result = await makeUseCase().execute({ now: NOW });

      expect(result.value.ran).toBe(true);
    });

    it('stamps the run before sweeping', async () => {
      const order: string[] = [];
      repository.recordRun.mockImplementation(async () => {
        order.push('stamp');
        return Result.ok();
      });
      scanner.scan.mockImplementation(async () => {
        order.push('scan');
        return Result.ok([]);
      });

      await makeUseCase().execute({ now: NOW });

      expect(order).toEqual(['stamp', 'scan']);
    });

    it('sweeps nothing when the run cannot be stamped', async () => {
      repository.recordRun.mockResolvedValue(Result.fail('db down'));

      const result = await makeUseCase().execute({ now: NOW });

      expect(result.isFailure).toBe(true);
      expect(scanner.scan).not.toHaveBeenCalled();
    });

    it('fails when the settings cannot be read', async () => {
      repository.get.mockResolvedValue(Result.fail('db down'));

      const result = await makeUseCase().execute({ now: NOW });

      expect(result.error).toBe('db down');
    });
  });

  describe('[DEV-211] each segment', () => {
    it('is swept one after the other and recorded as a scan', async () => {
      repository.get.mockResolvedValue(
        Result.ok(
          makeSettings([
            { cidr: '192.168.1.0/24', agentId: null },
            { cidr: '10.0.0.0/24', agentId: AGENT }
          ])
        )
      );
      let inFlight = 0;
      let maxInFlight = 0;
      scanner.scan.mockImplementation(async () => {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((r) => setImmediate(r));
        inFlight--;
        return Result.ok([HOST]);
      });

      const result = await makeUseCase().execute({ now: NOW });

      expect(maxInFlight).toBe(1);
      expect(scanner.scan.mock.calls).toEqual([
        ['192.168.1.0/24', null],
        ['10.0.0.0/24', AGENT]
      ]);
      expect(recorder.record).toHaveBeenCalledWith({
        source: DiscoverySource.SCAN,
        segment: '192.168.1.0/24',
        where: '192.168.1.0/24',
        seenAt: NOW,
        hosts: [HOST]
      });
      expect(result.value.segments).toEqual([
        {
          cidr: '192.168.1.0/24',
          agentId: null,
          responsiveCount: 1,
          newCount: 1,
          error: null
        },
        {
          cidr: '10.0.0.0/24',
          agentId: AGENT,
          responsiveCount: 1,
          newCount: 1,
          error: null
        }
      ]);
    });

    it('that fails is reported and the next one still runs', async () => {
      repository.get.mockResolvedValue(
        Result.ok(
          makeSettings([
            { cidr: '192.168.1.0/24', agentId: null },
            { cidr: '192.168.2.0/24', agentId: null }
          ])
        )
      );
      scanner.scan.mockResolvedValueOnce(
        Result.fail('Scan failed: boom')
      );

      const result = await makeUseCase().execute({ now: NOW });

      expect(result.value.segments[0]).toEqual({
        cidr: '192.168.1.0/24',
        agentId: null,
        responsiveCount: null,
        newCount: null,
        error: 'Scan failed: boom'
      });
      expect(result.value.segments[1].error).toBeNull();
    });

    it('whose sightings cannot be recorded is reported', async () => {
      recorder.record.mockResolvedValue(Result.fail('disk full'));

      const result = await makeUseCase().execute({ now: NOW });

      expect(result.value.segments[0].error).toBe('disk full');
    });
  });

  describe('[DEV-212] off site', () => {
    it('a server segment is skipped and an agent segment still runs', async () => {
      repository.get.mockResolvedValue(
        Result.ok(
          makeSettings([
            { cidr: '192.168.1.0/24', agentId: null },
            { cidr: '10.0.0.0/24', agentId: AGENT }
          ])
        )
      );

      const result = await makeUseCase(false).execute({ now: NOW });

      expect(result.value.segments[0].error).toBe(
        SCAN_NEEDS_SERVER_ON_SITE
      );
      expect(scanner.scan).toHaveBeenCalledTimes(1);
      expect(scanner.scan).toHaveBeenCalledWith('10.0.0.0/24', AGENT);
    });
  });

  describe('[DEV-217] router neighbours', () => {
    let routerNeighbors: jest.Mocked<IRouterNeighborQuery>;

    beforeEach(() => {
      routerNeighbors = {
        findRouterNeighbors: jest.fn().mockResolvedValue(
          Result.ok({
            routers: [
              {
                routerDeviceId: 'hex-1',
                routerName: 'Hex Norte',
                ports: [],
                neighbors: [
                  {
                    port: 'ether1',
                    macAddress: '24:A4:3C:00:00:01',
                    ipAddress: '10.0.7.21',
                    identity: 'AP 32',
                    platform: 'LiteBeam M5',
                    board: null,
                    version: 'XW.v6.3.6',
                    remoteInterface: 'br0'
                  },
                  {
                    port: 'ether1',
                    macAddress: '48:8F:5A:00:00:02',
                    ipAddress: '10.0.7.2',
                    identity: 'Hex Sur',
                    platform: 'MikroTik',
                    board: 'RB960PGS',
                    version: '6.48.6',
                    remoteInterface: 'bridge/ether1'
                  }
                ]
              }
            ],
            unreadRouters: [
              { deviceId: 'core', name: 'Core', reason: 'timeout' }
            ]
          })
        ),
        findRouterNeighborsOf: jest.fn()
      };
    });

    it('records each router as a batch of its neighbours', async () => {
      const result = await makeUseCase(true, routerNeighbors).execute(
        {
          now: NOW
        }
      );

      const batch = recorder.record.mock.calls[1]![0];
      expect(batch).toMatchObject({
        source: DiscoverySource.ROUTER_NEIGHBOR,
        segment: null,
        where: 'Hex Norte',
        seenAt: NOW
      });
      expect(batch.hosts).toEqual([
        {
          macAddress: '24:A4:3C:00:00:01',
          ipAddress: '10.0.7.21',
          manufacturer: null,
          hostname: 'AP 32',
          model: 'LiteBeam M5'
        },
        {
          macAddress: '48:8F:5A:00:00:02',
          ipAddress: '10.0.7.2',
          manufacturer: null,
          hostname: 'Hex Sur',
          model: 'RB960PGS'
        }
      ]);
      expect(result.value.routers).toEqual([
        {
          deviceId: 'hex-1',
          name: 'Hex Norte',
          neighborCount: 2,
          newCount: 2,
          error: null
        },
        {
          deviceId: 'core',
          name: 'Core',
          neighborCount: null,
          newCount: null,
          error: 'timeout'
        }
      ]);
    });

    it('runs with no segments when routers are read', async () => {
      repository.get.mockResolvedValue(Result.ok(makeSettings([])));

      const result = await makeUseCase(true, routerNeighbors).execute(
        {
          now: NOW
        }
      );

      expect(result.value.ran).toBe(true);
      expect(result.value.routers).toHaveLength(2);
    });

    it('reports a router whose neighbours cannot be recorded', async () => {
      repository.get.mockResolvedValue(Result.ok(makeSettings([])));
      recorder.record.mockResolvedValue(Result.fail('disk full'));

      const result = await makeUseCase(true, routerNeighbors).execute(
        {
          now: NOW
        }
      );

      expect(result.value.routers[0]).toMatchObject({
        deviceId: 'hex-1',
        error: 'disk full'
      });
    });

    it('fails when the routers cannot be listed', async () => {
      routerNeighbors.findRouterNeighbors.mockResolvedValue(
        Result.fail('db down')
      );

      const result = await makeUseCase(true, routerNeighbors).execute(
        {
          now: NOW
        }
      );

      expect(result.error).toContain('db down');
    });
  });

  describe('[DEV-218] router ARP tables', () => {
    let routerHosts: jest.Mocked<IRouterHostQuery>;

    beforeEach(() => {
      repository.get.mockResolvedValue(
        Result.ok(
          makeSettings([{ cidr: '10.0.7.0/24', agentId: null }])
        )
      );
      routerHosts = {
        findRouterHosts: jest.fn().mockResolvedValue(
          Result.ok({
            routers: [
              {
                routerDeviceId: 'core',
                routerName: 'Core',
                ports: [],
                bridgeHosts: [],
                arp: [
                  {
                    ipAddress: '10.0.7.30',
                    macAddress: 'AA:00:00:00:00:30'
                  },
                  {
                    ipAddress: '10.0.7.31',
                    macAddress: 'AA:00:00:00:00:31'
                  }
                ],
                leases: [
                  {
                    ipAddress: '10.0.7.31',
                    macAddress: 'AA:00:00:00:00:31',
                    hostname: 'camara-patio'
                  },
                  {
                    ipAddress: '10.0.7.32',
                    macAddress: 'AA:00:00:00:00:32',
                    hostname: null
                  }
                ]
              },
              {
                routerDeviceId: 'hex-1',
                routerName: 'Hex Norte',
                ports: [],
                bridgeHosts: [],
                arp: null,
                leases: null
              }
            ],
            unreadRouters: [
              {
                deviceId: 'hex-2',
                name: 'Hex Sur',
                reason: 'timeout'
              }
            ]
          })
        )
      };
    });

    it('records each address inside the segments once, named by its lease', async () => {
      const result = await makeUseCase(
        true,
        null,
        routerHosts
      ).execute({
        now: NOW
      });

      const batch = recorder.record.mock.calls
        .map((c) => c[0])
        .find((b) => b.source === DiscoverySource.ROUTER_ARP)!;
      expect(batch).toMatchObject({
        source: DiscoverySource.ROUTER_ARP,
        segment: null,
        where: 'Core',
        seenAt: NOW
      });
      expect(batch.hosts).toEqual([
        {
          macAddress: 'AA:00:00:00:00:30',
          ipAddress: '10.0.7.30',
          manufacturer: null,
          hostname: null,
          model: null
        },
        {
          macAddress: 'AA:00:00:00:00:31',
          ipAddress: '10.0.7.31',
          manufacturer: null,
          hostname: 'camara-patio',
          model: null
        },
        {
          macAddress: 'AA:00:00:00:00:32',
          ipAddress: '10.0.7.32',
          manufacturer: null,
          hostname: null,
          model: null
        }
      ]);
      expect(result.value.arp).toEqual([
        {
          deviceId: 'core',
          name: 'Core',
          addressCount: 3,
          newCount: 3,
          error: null
        },
        {
          deviceId: 'hex-1',
          name: 'Hex Norte',
          addressCount: null,
          newCount: null,
          error:
            'The router did not answer its ARP table or DHCP leases'
        },
        {
          deviceId: 'hex-2',
          name: 'Hex Sur',
          addressCount: null,
          newCount: null,
          error: 'timeout'
        }
      ]);
    });

    it('runs with no segments when ARP tables are read', async () => {
      const result = await makeUseCase(
        true,
        null,
        routerHosts
      ).execute({
        now: NOW
      });

      expect(result.value.ran).toBe(true);
    });

    it('reports a router whose addresses cannot be recorded', async () => {
      recorder.record.mockResolvedValue(Result.fail('disk full'));

      const result = await makeUseCase(
        true,
        null,
        routerHosts
      ).execute({
        now: NOW
      });

      expect(result.value.arp[0]).toMatchObject({
        deviceId: 'core',
        error: 'disk full'
      });
    });

    it('fails when the routers cannot be listed', async () => {
      routerHosts.findRouterHosts.mockResolvedValue(
        Result.fail('db down')
      );

      const result = await makeUseCase(
        true,
        null,
        routerHosts
      ).execute({
        now: NOW
      });

      expect(result.error).toBe(
        "Failed to read the routers' ARP tables: db down"
      );
    });
  });
});
