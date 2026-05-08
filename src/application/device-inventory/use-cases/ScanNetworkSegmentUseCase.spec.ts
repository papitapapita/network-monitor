// Source: src/application/device-inventory/use-cases/ScanNetworkSegmentUseCase.ts

import { ILogger } from '../../shared/interfaces';
import { INetworkScannerService, DiscoveredHost } from '../interfaces';
import { ScanNetworkSegmentUseCase } from './ScanNetworkSegmentUseCase';

const createMockLogger = (): ILogger => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  fatal: jest.fn(),
  child: jest.fn().mockReturnThis(),
  setLevel: jest.fn()
});

const createMockNetworkScannerService = (): jest.Mocked<INetworkScannerService> => ({
  scan: jest.fn()
});

describe('ScanNetworkSegmentUseCase', () => {
  let useCase: ScanNetworkSegmentUseCase;
  let mockScanner: jest.Mocked<INetworkScannerService>;
  let mockLogger: ILogger;

  beforeEach(() => {
    jest.clearAllMocks();
    mockScanner = createMockNetworkScannerService();
    mockLogger = createMockLogger();
    useCase = new ScanNetworkSegmentUseCase(mockScanner, mockLogger);
  });

  describe('beforeExecute validation', () => {
    it('should return a failed result when segment is an empty string', async () => {
      const result = await useCase.execute({ segment: '' });

      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('segment is required');
      expect(mockScanner.scan).not.toHaveBeenCalled();
    });

    it('should return a failed result when segment contains only whitespace', async () => {
      const result = await useCase.execute({ segment: '   ' });

      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('segment is required');
      expect(mockScanner.scan).not.toHaveBeenCalled();
    });

    it('should return a failed result when segment is missing from the DTO', async () => {
      // Casting through unknown simulates a caller that omits the required field
      const result = await useCase.execute({ segment: undefined as unknown as string });

      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('segment is required');
      expect(mockScanner.scan).not.toHaveBeenCalled();
    });
  });

  describe('executeImpl — happy path', () => {
    it('should return a successful result with correct metadata for a /24 segment returning 3 hosts', async () => {
      const hosts: DiscoveredHost[] = [
        { ipAddress: '192.168.1.1', latencyMs: 2, macAddress: 'AA:BB:CC:DD:EE:FF', manufacturer: 'Acme Corp' },
        { ipAddress: '192.168.1.5', latencyMs: 5, macAddress: 'FF:EE:DD:CC:BB:AA', manufacturer: 'Widgets Inc' },
        { ipAddress: '192.168.1.20', latencyMs: 1, macAddress: null, manufacturer: null }
      ];
      mockScanner.scan.mockResolvedValue(hosts);

      const result = await useCase.execute({ segment: '192.168.1.0/24' });

      expect(result.isSuccess).toBe(true);
      expect(result.value.segment).toBe('192.168.1.0/24');
      expect(result.value.scannedCount).toBe(254);
      expect(result.value.responsiveCount).toBe(3);
      expect(result.value.discoveredHosts).toHaveLength(3);
    });

    it('should map all DiscoveredHost fields including null macAddress and manufacturer', async () => {
      const hosts: DiscoveredHost[] = [
        { ipAddress: '192.168.1.20', latencyMs: 1, macAddress: null, manufacturer: null }
      ];
      mockScanner.scan.mockResolvedValue(hosts);

      const result = await useCase.execute({ segment: '192.168.1.0/24' });

      expect(result.isSuccess).toBe(true);
      expect(result.value.discoveredHosts[0]).toEqual({
        ipAddress: '192.168.1.20',
        latencyMs: 1,
        macAddress: null,
        manufacturer: null
      });
    });

    it('should trim whitespace from segment before scanning and use trimmed value in response', async () => {
      mockScanner.scan.mockResolvedValue([]);

      const result = await useCase.execute({ segment: '  192.168.1.0/24  ' });

      expect(result.isSuccess).toBe(true);
      expect(result.value.segment).toBe('192.168.1.0/24');
      expect(mockScanner.scan).toHaveBeenCalledWith('192.168.1.0/24');
    });

    it('should return responsiveCount of 0 and empty discoveredHosts when scanner returns no hosts', async () => {
      mockScanner.scan.mockResolvedValue([]);

      const result = await useCase.execute({ segment: '192.168.1.0/24' });

      expect(result.isSuccess).toBe(true);
      expect(result.value.responsiveCount).toBe(0);
      expect(result.value.discoveredHosts).toEqual([]);
    });
  });

  describe('executeImpl — calculateCidrHostCount via scannedCount', () => {
    const setupScanWithHosts = (hosts: DiscoveredHost[] = []) => {
      mockScanner.scan.mockResolvedValue(hosts);
    };

    it('should report scannedCount of 1 for a /32 prefix (single host, no network/broadcast subtraction)', async () => {
      setupScanWithHosts();
      const result = await useCase.execute({ segment: '192.168.1.5/32' });

      expect(result.isSuccess).toBe(true);
      expect(result.value.scannedCount).toBe(1);
    });

    it('should report scannedCount of 2 for a /31 prefix (point-to-point link, no subtraction)', async () => {
      setupScanWithHosts();
      const result = await useCase.execute({ segment: '192.168.1.4/31' });

      expect(result.isSuccess).toBe(true);
      expect(result.value.scannedCount).toBe(2);
    });

    it('should report scannedCount of 2 for a /30 prefix (4 total, minus network and broadcast)', async () => {
      setupScanWithHosts();
      const result = await useCase.execute({ segment: '10.0.0.0/30' });

      expect(result.isSuccess).toBe(true);
      expect(result.value.scannedCount).toBe(2);
    });

    it('should report scannedCount of 1022 for a /22 prefix (1024 total, minus network and broadcast)', async () => {
      setupScanWithHosts();
      const result = await useCase.execute({ segment: '10.0.0.0/22' });

      expect(result.isSuccess).toBe(true);
      expect(result.value.scannedCount).toBe(1022);
    });
  });

  describe('error handling', () => {
    it('should return a failed Result containing "Unexpected error" when the scanner service throws', async () => {
      mockScanner.scan.mockRejectedValue(new Error('Network timeout'));

      const result = await useCase.execute({ segment: '192.168.1.0/24' });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Unexpected error');
      expect(result.error).toContain('Network timeout');
    });

    it('should return a failed Result containing "Unexpected error" when the scanner rejects with a non-Error value', async () => {
      mockScanner.scan.mockRejectedValue('something went wrong');

      const result = await useCase.execute({ segment: '192.168.1.0/24' });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Unexpected error');
    });
  });

  describe('Result contract', () => {
    it('should call the scanner with exactly the trimmed CIDR string', async () => {
      mockScanner.scan.mockResolvedValue([]);

      await useCase.execute({ segment: '10.0.0.0/30' });

      expect(mockScanner.scan).toHaveBeenCalledTimes(1);
      expect(mockScanner.scan).toHaveBeenCalledWith('10.0.0.0/30');
    });

    it('should not call the scanner when beforeExecute fails', async () => {
      await useCase.execute({ segment: '' });

      expect(mockScanner.scan).not.toHaveBeenCalled();
    });
  });
});
