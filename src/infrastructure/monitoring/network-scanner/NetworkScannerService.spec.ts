// Source: src/infrastructure/monitoring/network-scanner/NetworkScannerService.ts

jest.mock('mac-oui-lookup', () => jest.fn());

import getVendor from 'mac-oui-lookup';
import { Result } from 'domain/shared/core';
import {
  IPingService,
  PingResponse
} from 'application/device-monitoring/interfaces';
import { IArpService } from 'application/device-inventory/interfaces';
import { NetworkScannerService } from './NetworkScannerService';

const mockGetVendor = getVendor as jest.MockedFunction<
  typeof getVendor
>;

const createMockPingService = (): jest.Mocked<IPingService> => ({
  ping: jest.fn()
});

const createMockArpService = (): jest.Mocked<IArpService> => ({
  toMAC: jest.fn()
});

const reachable = (
  latencyMs: number | null = 5
): Result<PingResponse> =>
  Result.ok({ isReachable: true, latencyMs });

const unreachable = (): Result<PingResponse> =>
  Result.ok({ isReachable: false, latencyMs: null });

describe('NetworkScannerService', () => {
  let service: NetworkScannerService;
  let pingService: jest.Mocked<IPingService>;
  let arpService: jest.Mocked<IArpService>;

  beforeEach(() => {
    jest.clearAllMocks();
    pingService = createMockPingService();
    arpService = createMockArpService();
    service = new NetworkScannerService(pingService, arpService);
  });

  describe('scan — host reachability filtering', () => {
    it('should return an empty array when all hosts are unreachable', async () => {
      pingService.ping.mockResolvedValue(unreachable());

      const result = await service.scan('10.0.0.0/30');

      expect(result).toEqual([]);
    });

    it('should return an empty array when ping returns a failed Result for every host', async () => {
      pingService.ping.mockResolvedValue(Result.fail('ping error'));

      const result = await service.scan('10.0.0.0/30');

      expect(result).toEqual([]);
    });

    it('should include only the reachable hosts when some are reachable and some are not', async () => {
      // /30 expands to two hosts: 10.0.0.1 and 10.0.0.2
      pingService.ping
        .mockResolvedValueOnce(reachable(3)) // 10.0.0.1 — reachable
        .mockResolvedValueOnce(unreachable()); // 10.0.0.2 — not reachable

      arpService.toMAC.mockResolvedValue(null);
      mockGetVendor.mockReturnValue(null);

      const result = await service.scan('10.0.0.0/30');

      expect(result).toHaveLength(1);
      expect(result[0]!.ipAddress).toBe('10.0.0.1');
    });
  });

  describe('scan — DiscoveredHost field mapping', () => {
    it('should populate all fields when the host is reachable, ARP resolves a MAC, and a manufacturer is found', async () => {
      pingService.ping.mockResolvedValue(reachable(4));
      arpService.toMAC.mockResolvedValue('AA:BB:CC:DD:EE:FF');
      mockGetVendor.mockReturnValue('Acme Corp');

      const result = await service.scan('10.0.0.0/30');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        ipAddress: '10.0.0.1',
        latencyMs: 4,
        macAddress: 'AA:BB:CC:DD:EE:FF',
        manufacturer: 'Acme Corp'
      });
    });

    it('should set manufacturer to null when getVendor returns null for a resolved MAC', async () => {
      pingService.ping.mockResolvedValue(reachable(2));
      arpService.toMAC.mockResolvedValue('AA:BB:CC:DD:EE:FF');
      mockGetVendor.mockReturnValue(null);

      const result = await service.scan('10.0.0.0/30');

      expect(result[0]!.macAddress).toBe('AA:BB:CC:DD:EE:FF');
      expect(result[0]!.manufacturer).toBeNull();
    });

    it('should set macAddress and manufacturer to null when ARP returns null', async () => {
      pingService.ping.mockResolvedValue(reachable(2));
      arpService.toMAC.mockResolvedValue(null);

      const result = await service.scan('10.0.0.0/30');

      expect(result[0]!.macAddress).toBeNull();
      expect(result[0]!.manufacturer).toBeNull();
      // getVendor must not be called when there is no MAC to look up
      expect(mockGetVendor).not.toHaveBeenCalled();
    });

    it('should store latencyMs as 0 when the ping response carries a null latency', async () => {
      pingService.ping.mockResolvedValue(reachable(null));
      arpService.toMAC.mockResolvedValue(null);

      const result = await service.scan('10.0.0.0/30');

      expect(result[0]!.latencyMs).toBe(0);
    });
  });

  describe('scan — concurrency batching', () => {
    it('should process all hosts across multiple chunks when concurrency is smaller than the host count', async () => {
      // /30 → [10.0.0.1, 10.0.0.2]; with concurrency=1 these are two separate chunks
      pingService.ping.mockResolvedValue(reachable(1));
      arpService.toMAC.mockResolvedValue(null);
      mockGetVendor.mockReturnValue(null);

      const result = await service.scan('10.0.0.0/30', 1);

      expect(result).toHaveLength(2);
      expect(result.map((h) => h.ipAddress)).toEqual([
        '10.0.0.1',
        '10.0.0.2'
      ]);
    });
  });

  describe('scan — invalid CIDR propagation', () => {
    it('should propagate the error thrown by expandCidr when the CIDR is invalid', async () => {
      await expect(service.scan('not-a-cidr')).rejects.toThrow(
        'missing prefix length'
      );
    });

    it('should propagate the error thrown by expandCidr when the CIDR range is too large', async () => {
      await expect(service.scan('10.0.0.0/21')).rejects.toThrow(
        'CIDR range too large'
      );
    });
  });
});
