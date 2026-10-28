// Source: src/application/device-inventory/use-cases/ScanNetworkSegmentUseCase.ts

import {
  ScanNetworkSegmentUseCase,
  SCAN_AGENT_NOT_FOUND,
  SCAN_NEEDS_SERVER_ON_SITE
} from '../../../../src/application/device-inventory/use-cases/ScanNetworkSegmentUseCase';
import {
  DiscoveredHost,
  IAgentAssignmentQuery,
  ISegmentScanner
} from '../../../../src/application/device-inventory/interfaces';
import { ILogger } from '../../../../src/application/shared/interfaces';
import { ScanNetworkSegmentRequestDTO } from '../../../../src/application/device-inventory/dtos';
import {
  DeviceSightingRecorder,
  SightingBatch
} from '../../../../src/application/device-inventory/services';
import { DiscoverySource } from '../../../../src/domain/device-inventory/enums';
import { Result } from '../../../../src/domain/shared/core';

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

const AGENT = '0b9c6f0e-3f4a-4c55-9a51-6f7d2a1c8e10';

function makeScanner(): jest.Mocked<ISegmentScanner> {
  return { scan: jest.fn() };
}

function makeAgents(): jest.Mocked<IAgentAssignmentQuery> {
  return {
    check: jest.fn().mockResolvedValue(Result.ok('ASSIGNABLE')),
    listAssignable: jest.fn()
  };
}

function makeRecorder(): jest.Mocked<DeviceSightingRecorder> {
  return {
    record: jest.fn(async (batch: SightingBatch) =>
      Result.ok(
        batch.hosts.map(() => ({
          knownDeviceId: null,
          discoveredDeviceId: null,
          isNew: false
        }))
      )
    )
  } as unknown as jest.Mocked<DeviceSightingRecorder>;
}

function makeHost(
  overrides: Partial<DiscoveredHost> = {}
): DiscoveredHost {
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
  let scanner: jest.Mocked<ISegmentScanner>;
  let agents: jest.Mocked<IAgentAssignmentQuery>;
  let logger: ILogger;
  let recorder: jest.Mocked<DeviceSightingRecorder>;
  let useCase: ScanNetworkSegmentUseCase;

  beforeEach(() => {
    scanner = makeScanner();
    agents = makeAgents();
    logger = makeLogger();
    recorder = makeRecorder();
    useCase = new ScanNetworkSegmentUseCase(
      scanner,
      recorder,
      agents,
      logger
    );

    found([]);
  });

  function found(hosts: DiscoveredHost[]): void {
    scanner.scan.mockResolvedValue(Result.ok(hosts));
  }

  afterEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  describe('[DEV-171] a server hosted off site', () => {
    it('should refuse to scan without sweeping anything', async () => {
      const offSite = new ScanNetworkSegmentUseCase(
        scanner,
        recorder,
        agents,
        logger,
        false
      );

      const result = await offSite.execute(makeRequest());

      expect(result.isFailure).toBe(true);
      expect(result.error).toBe(SCAN_NEEDS_SERVER_ON_SITE);
      expect(scanner.scan).not.toHaveBeenCalled();
    });

    it('[DEV-214] scans through an agent', async () => {
      const offSite = new ScanNetworkSegmentUseCase(
        scanner,
        recorder,
        agents,
        logger,
        false
      );

      const result = await offSite.execute(
        makeRequest({ agentId: AGENT })
      );

      expect(result.isSuccess).toBe(true);
      expect(scanner.scan).toHaveBeenCalledWith(
        '192.168.1.0/24',
        AGENT
      );
    });
  });

  // =========================================================================
  describe('[DEV-214] scanning from an agent', () => {
    it('should name the agent in the response', async () => {
      const result = await useCase.execute(
        makeRequest({ agentId: AGENT })
      );

      expect(result.value!.agentId).toBe(AGENT);
    });

    it('should scan from the server when agentId is null', async () => {
      const result = await useCase.execute(
        makeRequest({ agentId: null })
      );

      expect(scanner.scan).toHaveBeenCalledWith(
        '192.168.1.0/24',
        null
      );
      expect(result.value!.agentId).toBeNull();
      expect(agents.check).not.toHaveBeenCalled();
    });

    it('should fail when agentId is not an agent id', async () => {
      const result = await useCase.execute(
        makeRequest({ agentId: 'nope' })
      );

      expect(result.error).toBe('agentId must be an agent id');
      expect(scanner.scan).not.toHaveBeenCalled();
    });

    it.each(['NOT_FOUND', 'REVOKED'] as const)(
      'should fail when the agent is %s',
      async (assignability) => {
        agents.check.mockResolvedValue(Result.ok(assignability));

        const result = await useCase.execute(
          makeRequest({ agentId: AGENT })
        );

        expect(result.error).toBe(SCAN_AGENT_NOT_FOUND);
        expect(scanner.scan).not.toHaveBeenCalled();
      }
    );

    it('should fail when the agent cannot be checked', async () => {
      agents.check.mockResolvedValue(Result.fail('db down'));

      const result = await useCase.execute(
        makeRequest({ agentId: AGENT })
      );

      expect(result.error).toBe('Failed to check the agent: db down');
    });
  });

  // =========================================================================
  describe('[DEV-143] beforeExecute — validation', () => {
    it('should fail when segment is an empty string', async () => {
      const result = await useCase.execute(
        makeRequest({ segment: '' })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('segment is required');
    });

    it('should fail when segment is whitespace only', async () => {
      const result = await useCase.execute(
        makeRequest({ segment: '   ' })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('segment is required');
    });

    it('should fail when segment is missing from the request', async () => {
      // Casting through unknown simulates a caller that omits the field.
      const result = await useCase.execute(
        makeRequest({ segment: undefined as unknown as string })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('segment is required');
      expect(scanner.scan).not.toHaveBeenCalled();
    });

    it('should not call scanner.scan when beforeExecute fails', async () => {
      await useCase.execute(makeRequest({ segment: '' }));

      expect(scanner.scan).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  describe('executeImpl — scanner invocation', () => {
    it('should call scanner.scan with the trimmed segment', async () => {
      await useCase.execute(
        makeRequest({ segment: '  192.168.1.0/24  ' })
      );

      expect(scanner.scan).toHaveBeenCalledTimes(1);
      expect(scanner.scan).toHaveBeenCalledWith(
        '192.168.1.0/24',
        null
      );
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
      found([makeHost(), makeHost()]);

      const result = await useCase.execute(makeRequest());

      expect(result.value!.responsiveCount).toBe(2);
    });

    it('should return zero responsiveCount when no hosts are found', async () => {
      found([]);

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
      found([host]);

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
      found([host]);

      const result = await useCase.execute(makeRequest());

      const discovered = result.value!.discoveredHosts[0];
      expect(discovered.macAddress).toBeNull();
      expect(discovered.manufacturer).toBeNull();
    });

    it('should return an empty discoveredHosts array when no hosts respond', async () => {
      found([]);

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

    it('should calculate scannedCount as 2 for a /30 segment', async () => {
      const result = await useCase.execute(
        makeRequest({ segment: '10.0.0.0/30' })
      );

      expect(result.value!.scannedCount).toBe(2);
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
      found(hosts);

      const result = await useCase.execute(
        makeRequest({ segment: '10.0.0.0/24' })
      );

      expect(result.value!.discoveredHosts).toHaveLength(3);
      expect(result.value!.responsiveCount).toBe(3);
    });
  });

  describe('[DEV-200] executeImpl — sightings', () => {
    it('should record every responsive host as a scan of the segment', async () => {
      const hosts = [makeHost({ ipAddress: '10.0.0.1' })];
      found(hosts);

      await useCase.execute(
        makeRequest({ segment: ' 10.0.0.0/24 ' })
      );

      expect(recorder.record).toHaveBeenCalledWith(
        expect.objectContaining({
          source: DiscoverySource.SCAN,
          segment: '10.0.0.0/24',
          where: '10.0.0.0/24',
          hosts
        })
      );
    });

    it('should mark each host with what the recorder matched', async () => {
      found([
        makeHost({ ipAddress: '10.0.0.1' }),
        makeHost({ ipAddress: '10.0.0.2' })
      ]);
      recorder.record.mockResolvedValue(
        Result.ok([
          {
            knownDeviceId: 'dev-1',
            discoveredDeviceId: null,
            isNew: false
          },
          {
            knownDeviceId: null,
            discoveredDeviceId: 'dd-1',
            isNew: true
          }
        ])
      );

      const result = await useCase.execute(makeRequest());

      expect(result.value!.newCount).toBe(1);
      expect(result.value!.discoveredHosts[0]).toMatchObject({
        ipAddress: '10.0.0.1',
        knownDeviceId: 'dev-1',
        discoveredDeviceId: null,
        isNew: false
      });
      expect(result.value!.discoveredHosts[1]).toMatchObject({
        ipAddress: '10.0.0.2',
        knownDeviceId: null,
        discoveredDeviceId: 'dd-1',
        isNew: true
      });
    });

    it('should fail when the sightings cannot be recorded', async () => {
      recorder.record.mockResolvedValue(Result.fail('db down'));

      const result = await useCase.execute(makeRequest());

      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('db down');
    });
  });

  describe('executeImpl — scanner failures', () => {
    it('should fail with the scanner error', async () => {
      scanner.scan.mockResolvedValue(
        Result.fail('Scan failed: Network timeout')
      );

      const result = await useCase.execute(makeRequest());

      expect(result.error).toBe('Scan failed: Network timeout');
      expect(recorder.record).not.toHaveBeenCalled();
    });

    it('should fail with the scanner error when the scanner throws', async () => {
      scanner.scan.mockRejectedValue(new Error('Network timeout'));

      const result = await useCase.execute(makeRequest());

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Unexpected error');
      expect(result.error).toContain('Network timeout');
    });

    it('should fail when the scanner rejects with a non-Error value', async () => {
      scanner.scan.mockRejectedValue('something went wrong');

      const result = await useCase.execute(makeRequest());

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Unexpected error');
    });
  });
});
