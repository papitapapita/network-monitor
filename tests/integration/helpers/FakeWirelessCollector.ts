import { Result } from 'domain/shared/core/Result';
import {
  IWirelessCollector,
  IWirelessCollectorResolver,
  WirelessCollectionResult
} from 'application/wireless-monitoring/interfaces';

/**
 * Controllable stand-in for a radio. Doubles as its own resolver so a use
 * case gets it for any vendor slug. Call setResult() to change the reading
 * or fail() to make every read error.
 */
export class FakeWirelessCollector
  implements IWirelessCollector, IWirelessCollectorResolver
{
  readonly method = 'http_api' as const;
  readonly calls: string[] = [];
  private result: Result<WirelessCollectionResult> = Result.ok(
    FakeWirelessCollector.reading()
  );

  static reading(
    overrides: Partial<WirelessCollectionResult> = {}
  ): WirelessCollectionResult {
    return {
      deviceName: 'CPE-Fake',
      firmwareVersion: 'WA.v8.7.11',
      uptimeSeconds: 1000,
      deviceTimeEpoch: null,
      cpuLoadPercent: 10,
      memoryUsedPercent: 40,
      essid: 'ISP',
      mode: 'sta-ptmp',
      frequencyMhz: 5180,
      channelWidthMhz: 20,
      noiseFloorDbm: -95,
      throughputTxBps: 1_000_000,
      throughputRxBps: 2_000_000,
      wirelessTxBytes: null,
      wirelessRxBytes: null,
      distanceM: 800,
      clientsConnected: null,
      ccqPercent: 95,
      signalRxDbm: -60,
      signalTxDbm: -62,
      latencyMs: 2,
      remoteApMac: null,
      remoteApName: 'AP-Fake',
      remoteApIp: null,
      capacityTxKbps: 50_000,
      capacityRxKbps: 60_000,
      lanStatus: 'UP',
      lanSpeedMbps: 100,
      macAddress: null,
      deviceModel: 'LiteBeam 5AC',
      clients: [],
      ...overrides
    };
  }

  setResult(overrides: Partial<WirelessCollectionResult> = {}): void {
    this.result = Result.ok(FakeWirelessCollector.reading(overrides));
  }

  fail(error: string): void {
    this.result = Result.fail(error);
  }

  reset(): void {
    this.calls.length = 0;
    this.setResult();
  }

  forVendor(_vendorSlug: string): IWirelessCollector {
    return this;
  }

  async collect(
    ipAddress: string
  ): Promise<Result<WirelessCollectionResult>> {
    this.calls.push(ipAddress);
    return this.result;
  }
}
