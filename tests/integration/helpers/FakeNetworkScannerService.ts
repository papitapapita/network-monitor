import {
  INetworkScannerService,
  DiscoveredHost
} from 'application/device-inventory/interfaces';

/**
 * Controllable stub for INetworkScannerService used in integration tests.
 * A real scan sweeps a CIDR with ICMP, so it must never run in a test.
 * Call setHosts() to control what the scan reports back.
 */
export class FakeNetworkScannerService implements INetworkScannerService {
  private _hosts: DiscoveredHost[] = [];
  public lastCidr: string | null = null;
  public callCount = 0;

  setHosts(hosts: DiscoveredHost[]): void {
    this._hosts = hosts;
  }

  reset(): void {
    this._hosts = [];
    this.lastCidr = null;
    this.callCount = 0;
  }

  async scan(
    cidr: string,
    _concurrency?: number
  ): Promise<DiscoveredHost[]> {
    this.lastCidr = cidr;
    this.callCount++;
    return this._hosts;
  }
}
