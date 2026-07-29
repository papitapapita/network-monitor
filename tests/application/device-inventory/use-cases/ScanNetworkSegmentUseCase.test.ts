// Source: src/application/device-inventory/use-cases/ScanNetworkSegmentUseCase.ts

import { ScanNetworkSegmentUseCase } from '../../../../src/application/device-inventory/use-cases/ScanNetworkSegmentUseCase';
import { INetworkScannerService, DiscoveredHost } from '../../../../src/application/device-inventory/interfaces';
import { ILogger } from '../../../../src/application/shared/interfaces';
import { ScanNetworkSegmentRequestDTO } from '../../../../src/application/device-inventory/dtos';

// ---------------------------------------------------------------------------
// Stub factories
// ---------------------------------------------------------------------------

function makeLogger(): ILogger {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
    child: jest.fn().mockReturnThis(),
    setLevel: jest.fn()
  };
}

function makeScanner(): jest.Mocked<INetworkScannerService> {
  return { scan: jest.fn() };
}

function makeHost(overrides: Partial<DiscoveredHost> = {}): DiscoveredHost {
  return {
    ipAddress: '192.168.1.1',
    latencyMs: 2,
    macAddress: 'AA:BB:CC:DD:EE:FF',
    manufacturer: 'TP-Link',
    ...overrides
  };
}

function makeRequest(
  overrides: Partial<ScanNetworkSegmentRequestDTO> = {}
): ScanNetworkSegmentRequestDTO {
  return { segment: '192.168.1.0/24', ...overrides };
}

// ---------------------------------------------------------------------------

describe('ScanNetworkSegmentUseCase', () => {
  let scanner: jest.Mocked<INetworkScannerService>;
  let logger: ILogger;
  let useCase: ScanNetworkSegmentUseCase;

  beforeEach(() => {
    scanner = makeScanner();
    logger = makeLogger();
    useCase = new ScanNetworkSegmentUseCase(scanner, logger);

    scanner.scan.mockResolvedValue([]);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  describe('[DEV-143] beforeExecute — validation', () => {
    it('should fail when segment is an empty string', async () => {
      const result = await useCase.execute(makeRequest({ segment: '' }));

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('segment is required');
    });

    it('should fail when segment is whitespace only', async () => {
      const result = await useCase.execute(makeRequest({ segment: '   ' }));

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('segment is required');
    });

    it('should not call scanner.scan when beforeExecute fails', async () => {
      await useCase.execute(makeRequest({ segment: '' }));

      expect(scanner.scan).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  describe('executeImpl — scanner invocation', () => {
    it('should call scanner.scan with the trimmed segment', async () => {
      await useCase.execute(makeRequest({ segment: '  192.168.1.0/24  ' }));

      expect(scanner.scan).toHaveBeenCalledTimes(1);
      expect(scanner.scan).toHaveBeenCalledWith('192.168.1.0/24');
    });

    it('should call scanner.scan exactly once per execution', async () => {
      await useCase.execute(makeRequest());

      expect(scanner.scan).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  describe('executeImpl — response structure', () => {
    it('should return isSuccess true', async () => {
      const result = await useCase.execute(makeRequest());

      expect(result.isSuccess).toBe(true);
    });

    it('should return the trimmed segment in the response', async () => {
      const result = await useCase.execute(
        makeRequest({ segment: '  10.0.0.0/8  ' })
      );

      expect(result.value!.segment).toBe('10.0.0.0/8');
    });

    it('should return responsiveCount equal to the number of discovered hosts', async () => {
      scanner.scan.mockResolvedValue([makeHost(), makeHost()]);

      const result = await useCase.execute(makeRequest());

      expect(result.value!.responsiveCount).toBe(2);
    });

    it('should return zero responsiveCount when no hosts are found', async () => {
      scanner.scan.mockResolvedValue([]);

      const result = await useCase.execute(makeRequest());

      expect(result.value!.responsiveCount).toBe(0);
    });

    it('should return discoveredHosts mapped from scanner results', async () => {
      const host = makeHost({
        ipAddress: '192.168.1.5',
        latencyMs: 4,
        macAddress: 'DC:A6:32:00:11:22',
        manufacturer: 'Raspberry Pi'
      });
      scanner.scan.mockResolvedValue([host]);

      const result = await useCase.execute(makeRequest());

      expect(result.value!.discoveredHosts).toHaveLength(1);
      const discovered = result.value!.discoveredHosts[0];
      expect(discovered.ipAddress).toBe('192.168.1.5');
      expect(discovered.latencyMs).toBe(4);
      expect(discovered.macAddress).toBe('DC:A6:32:00:11:22');
      expect(discovered.manufacturer).toBe('Raspberry Pi');
    });

    it('should include hosts with null macAddress and manufacturer', async () => {
      const host = makeHost({ macAddress: null, manufacturer: null });
      scanner.scan.mockResolvedValue([host]);

      const result = await useCase.execute(makeRequest());

      const discovered = result.value!.discoveredHosts[0];
      expect(discovered.macAddress).toBeNull();
      expect(discovered.manufacturer).toBeNull();
    });

    it('should return an empty discoveredHosts array when no hosts respond', async () => {
      scanner.scan.mockResolvedValue([]);

      const result = await useCase.execute(makeRequest());

      expect(result.value!.discoveredHosts).toEqual([]);
    });
  });

  // =========================================================================
  describe('[DEV-143] executeImpl — scannedCount calculation (/24 CIDR)', () => {
    it('should calculate scannedCount as 254 for a /24 segment', async () => {
      const result = await useCase.execute(
        makeRequest({ segment: '192.168.1.0/24' })
      );

      expect(result.value!.scannedCount).toBe(254);
    });

    it('should calculate scannedCount as 14 for a /28 segment', async () => {
      const result = await useCase.execute(
        makeRequest({ segment: '10.0.0.0/28' })
      );

      expect(result.value!.scannedCount).toBe(14);
    });

    it('should calculate scannedCount as 1022 for a /22 segment', async () => {
      const result = await useCase.execute(
        makeRequest({ segment: '172.16.0.0/22' })
      );

      expect(result.value!.scannedCount).toBe(1022);
    });

    it('should calculate scannedCount as 2 for a /31 segment (RFC 3021)', async () => {
      const result = await useCase.execute(
        makeRequest({ segment: '192.168.1.0/31' })
      );

      expect(result.value!.scannedCount).toBe(2);
    });

    it('should calculate scannedCount as 1 for a /32 host route', async () => {
      const result = await useCase.execute(
        makeRequest({ segment: '192.168.1.1/32' })
      );

      expect(result.value!.scannedCount).toBe(1);
    });

    it('should return scannedCount of 0 when the segment is not valid CIDR notation', async () => {
      // Non-CIDR segment passes beforeExecute (non-empty) but returns 0 from the helper
      const result = await useCase.execute(
        makeRequest({ segment: '192.168.1.1' })
      );

      expect(result.isSuccess).toBe(true);
      expect(result.value!.scannedCount).toBe(0);
    });
  });

  // =========================================================================
  describe('executeImpl — multiple hosts', () => {
    it('should return all hosts returned by the scanner', async () => {
      const hosts = [
        makeHost({ ipAddress: '10.0.0.1' }),
        makeHost({ ipAddress: '10.0.0.2' }),
        makeHost({ ipAddress: '10.0.0.3' })
      ];
      scanner.scan.mockResolvedValue(hosts);

      const result = await useCase.execute(
        makeRequest({ segment: '10.0.0.0/24' })
      );

      expect(result.value!.discoveredHosts).toHaveLength(3);
      expect(result.value!.responsiveCount).toBe(3);
    });
  });
});
