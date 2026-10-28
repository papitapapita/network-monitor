// Source: src/infrastructure/monitoring/network-scanner/SegmentScanner.ts

import {
  AGENT_SCAN_NOT_AVAILABLE,
  SegmentScanner
} from '../../../../src/infrastructure/monitoring/network-scanner';
import { INetworkScannerService } from '../../../../src/application/device-inventory/interfaces';

const HOST = {
  ipAddress: '192.168.1.20',
  latencyMs: 3,
  macAddress: 'AA:BB:CC:DD:EE:01',
  manufacturer: null
};

describe('SegmentScanner', () => {
  let server: jest.Mocked<INetworkScannerService>;
  let scanner: SegmentScanner;

  beforeEach(() => {
    server = { scan: jest.fn().mockResolvedValue([HOST]) };
    scanner = new SegmentScanner(server);
  });

  it('[DEV-212] sweeps a server segment from the server', async () => {
    const result = await scanner.scan('192.168.1.0/24', null);

    expect(result.value).toEqual([HOST]);
    expect(server.scan).toHaveBeenCalledWith('192.168.1.0/24');
  });

  it('[DEV-212] turns a scanner error into a failure', async () => {
    server.scan.mockRejectedValue(new Error('CIDR range too large'));

    const result = await scanner.scan('10.0.0.0/16', null);

    expect(result.error).toBe('Scan failed: CIDR range too large');
  });

  it('[DEV-212] cannot sweep through an agent yet', async () => {
    const result = await scanner.scan(
      '10.0.0.0/24',
      '0b9c6f0e-3f4a-4c55-9a51-6f7d2a1c8e10'
    );

    expect(result.error).toBe(AGENT_SCAN_NOT_AVAILABLE);
    expect(server.scan).not.toHaveBeenCalled();
  });
});
