import { Result } from 'domain/shared/core';
import {
  DiscoveredHost,
  INetworkScannerService,
  ISegmentScanner
} from 'application/device-inventory/interfaces';

export const AGENT_SCAN_NOT_AVAILABLE =
  'Scanning through an agent is not available yet';

// Server segments go to the in-process scanner. Agent segments are saved
// already so the settings outlive the upgrade that teaches agents to scan.
export class SegmentScanner implements ISegmentScanner {
  constructor(
    private readonly serverScanner: INetworkScannerService
  ) {}

  async scan(
    cidr: string,
    agentId: string | null
  ): Promise<Result<DiscoveredHost[]>> {
    if (agentId !== null)
      return Result.fail(AGENT_SCAN_NOT_AVAILABLE);
    try {
      return Result.ok(await this.serverScanner.scan(cidr));
    } catch (error) {
      return Result.fail(`Scan failed: ${(error as Error).message}`);
    }
  }
}
