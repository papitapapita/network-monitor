// Source: src/infrastructure/monitoring/network-scanner/SegmentScanner.ts

jest.mock('mac-oui-lookup', () =>
  jest.fn((mac: string) =>
    mac.startsWith('DC:2C:6E') ? 'Routerboard.com' : null
  )
);

import { SegmentScanner } from '../../../../src/infrastructure/monitoring/network-scanner';
import {
  IAgentHostDiscovery,
  INetworkScannerService
} from '../../../../src/application/device-inventory/interfaces';
import { Result } from '../../../../src/domain/shared/core';

const AGENT = '0b9c6f0e-3f4a-4c55-9a51-6f7d2a1c8e10';

const HOST = {
  ipAddress: '192.168.1.20',
  latencyMs: 3,
  macAddress: 'AA:BB:CC:DD:EE:01',
  manufacturer: null
};

describe('SegmentScanner', () => {
  let server: jest.Mocked<INetworkScannerService>;
  let agents: jest.Mocked<IAgentHostDiscovery>;
  let scanner: SegmentScanner;

  beforeEach(() => {
    server = { scan: jest.fn().mockResolvedValue([HOST]) };
    agents = { discover: jest.fn().mockResolvedValue(Result.ok([])) };
    scanner = new SegmentScanner(server, agents);
  });

  it('[DEV-212] sweeps a server segment from the server', async () => {
    const result = await scanner.scan('192.168.1.0/24', null);

    expect(result.value).toEqual([HOST]);
    expect(server.scan).toHaveBeenCalledWith('192.168.1.0/24');
    expect(agents.discover).not.toHaveBeenCalled();
  });

  it('[DEV-212] turns a scanner error into a failure', async () => {
    server.scan.mockRejectedValue(
      new Error('raw socket unavailable')
    );

    const result = await scanner.scan('10.0.0.0/24', null);

    expect(result.error).toBe('Scan failed: raw socket unavailable');
  });

  it('[DEV-212] refuses a range too large before sweeping', async () => {
    const result = await scanner.scan('10.0.0.0/16', AGENT);

    expect(result.error).toBe(
      'Scan failed: CIDR range too large: maximum 1024 host addresses allowed'
    );
    expect(agents.discover).not.toHaveBeenCalled();
  });

  describe('[DEV-214] an agent segment', () => {
    it('is swept by its agent, the manufacturer looked up here', async () => {
      agents.discover.mockResolvedValue(
        Result.ok([
          {
            ipAddress: '10.0.0.1',
            macAddress: 'DC:2C:6E:11:22:33',
            latencyMs: 2
          },
          { ipAddress: '10.0.0.9', macAddress: null, latencyMs: null }
        ])
      );

      const result = await scanner.scan('10.0.0.0/24', AGENT);

      expect(agents.discover).toHaveBeenCalledWith(
        AGENT,
        '10.0.0.0/24'
      );
      expect(server.scan).not.toHaveBeenCalled();
      expect(result.value).toEqual([
        {
          ipAddress: '10.0.0.1',
          latencyMs: 2,
          macAddress: 'DC:2C:6E:11:22:33',
          manufacturer: 'Routerboard.com'
        },
        {
          ipAddress: '10.0.0.9',
          latencyMs: 0,
          macAddress: null,
          manufacturer: null
        }
      ]);
    });

    it('drops an address the agent sent from outside the segment', async () => {
      agents.discover.mockResolvedValue(
        Result.ok([
          { ipAddress: '10.0.0.0', macAddress: null, latencyMs: 1 },
          { ipAddress: '10.0.1.5', macAddress: null, latencyMs: 1 }
        ])
      );

      const result = await scanner.scan('10.0.0.0/24', AGENT);

      expect(result.value).toEqual([]);
    });

    it('fails with why the agent could not scan', async () => {
      agents.discover.mockResolvedValue(
        Result.fail('The agent is not connected')
      );

      const result = await scanner.scan('10.0.0.0/24', AGENT);

      expect(result.error).toBe(
        'The agent could not scan: The agent is not connected'
      );
    });
  });
});
