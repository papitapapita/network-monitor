import {
  INetworkScannerService,
  DiscoveredHost
} from 'application/device-inventory/interfaces';

/**
 * Controllable stub for INetworkScannerService used in integration tests.
 * A real scan sweeps a CIDR with ICMP, so it must never run in a test.
 * Call setHosts() to control what the scan reports back, or failWith() to
 * make it throw the way the real scanner does on a bad or oversized CIDR.
 */
export class FakeNetworkScannerService
  implements INetworkScannerService
{
  private _hosts: DiscoveredHost[] = [];
  private _error: Error | null = null;
  public lastCidr: string | null = null;
  public callCount = 0;

  setHosts(hosts: DiscoveredHost[]): void {
    this._hosts = hosts;
  }

  failWith(error: Error): void {
    this._error = error;
  }

  reset(): void {
    this._hosts = [];
    this._error = null;
    this.lastCidr = null;
    this.callCount = 0;
  }

  async scan(
    cidr: string,
    _concurrency?: number
  ): Promise<DiscoveredHost[]> {
    this.lastCidr = cidr;
    this.callCount++;
    if (this._error) throw this._error;
    return this._hosts;
  }
}
