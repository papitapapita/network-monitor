// Source: src/application/device-inventory/use-cases/ScanNetworkSegmentUseCase.ts

import { ScanNetworkSegmentUseCase } from 'application/device-inventory/use-cases/ScanNetworkSegmentUseCase';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import { FakeNetworkScannerService } from '../../helpers/FakeNetworkScannerService';

describe('ScanNetworkSegmentUseCase — integration', () => {
  let scanner: FakeNetworkScannerService;
  let useCase: ScanNetworkSegmentUseCase;

  beforeAll(() => {
    scanner = new FakeNetworkScannerService();
    useCase = new ScanNetworkSegmentUseCase(
      scanner,
      new WinstonLogger()
    );
  });

  beforeEach(() => {
    scanner.reset();
  });

  // ──────────────────────────────────────────────────────────────
  // Happy path
  // ──────────────────────────────────────────────────────────────

  it('reports the hosts the scanner discovered', async () => {
    scanner.setHosts([
      {
        ipAddress: '192.168.1.1',
        latencyMs: 2,
        macAddress: 'AA:BB:CC:DD:EE:01',
        manufacturer: 'MikroTik'
      },
      {
        ipAddress: '192.168.1.20',
        latencyMs: 8,
        macAddress: null,
        manufacturer: null
      }
    ]);

    const result = await useCase.execute({
      segment: '192.168.1.0/24'
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.segment).toBe('192.168.1.0/24');
    expect(result.value.responsiveCount).toBe(2);
    expect(result.value.discoveredHosts).toHaveLength(2);
    expect(result.value.discoveredHosts[0]).toEqual({
      ipAddress: '192.168.1.1',
      latencyMs: 2,
      macAddress: 'AA:BB:CC:DD:EE:01',
      manufacturer: 'MikroTik'
    });
  });

  it('passes the trimmed segment through to the scanner', async () => {
    await useCase.execute({ segment: '  10.0.0.0/24  ' });

    expect(scanner.callCount).toBe(1);
    expect(scanner.lastCidr).toBe('10.0.0.0/24');
  });

  it('succeeds with zero responsive hosts', async () => {
    scanner.setHosts([]);

    const result = await useCase.execute({
      segment: '192.168.99.0/24'
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.responsiveCount).toBe(0);
    expect(result.value.discoveredHosts).toHaveLength(0);
  });

  it('preserves a null MAC for hosts on another L2 segment', async () => {
    scanner.setHosts([
      {
        ipAddress: '10.1.2.3',
        latencyMs: 15,
        macAddress: null,
        manufacturer: null
      }
    ]);

    const result = await useCase.execute({ segment: '10.1.2.0/24' });

    expect(result.value.discoveredHosts[0].macAddress).toBeNull();
    expect(result.value.discoveredHosts[0].manufacturer).toBeNull();
  });

  // ──────────────────────────────────────────────────────────────
  // scannedCount — usable host arithmetic per prefix length
  // ──────────────────────────────────────────────────────────────

  it('[DEV-143] excludes network and broadcast addresses for a /24', async () => {
    const result = await useCase.execute({
      segment: '192.168.1.0/24'
    });

    expect(result.value.scannedCount).toBe(254);
  });

  it('[DEV-143] excludes network and broadcast addresses for a /16', async () => {
    const result = await useCase.execute({ segment: '10.0.0.0/16' });

    expect(result.value.scannedCount).toBe(65534);
  });

  it('[DEV-143] counts both addresses in a /31 point-to-point link', async () => {
    const result = await useCase.execute({ segment: '10.0.0.0/31' });

    expect(result.value.scannedCount).toBe(2);
  });

  it('[DEV-143] counts the single address in a /32', async () => {
    const result = await useCase.execute({ segment: '10.0.0.1/32' });

    expect(result.value.scannedCount).toBe(1);
  });

  it('[DEV-143] reports zero scanned for a segment with no prefix', async () => {
    const result = await useCase.execute({ segment: '10.0.0.1' });

    expect(result.isSuccess).toBe(true);
    expect(result.value.scannedCount).toBe(0);
  });

  it('[DEV-143] reports zero scanned for an out-of-range prefix', async () => {
    const result = await useCase.execute({ segment: '10.0.0.0/33' });

    expect(result.isSuccess).toBe(true);
    expect(result.value.scannedCount).toBe(0);
  });

  // ──────────────────────────────────────────────────────────────
  // Validation failures
  // ──────────────────────────────────────────────────────────────

  it('[DEV-143] fails when segment is empty', async () => {
    const result = await useCase.execute({ segment: '' });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/segment is required/i);
  });

  it('[DEV-143] fails when segment is only whitespace', async () => {
    const result = await useCase.execute({ segment: '   ' });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/segment is required/i);
  });

  it('does not invoke the scanner when validation fails', async () => {
    await useCase.execute({ segment: '' });

    expect(scanner.callCount).toBe(0);
  });
});
