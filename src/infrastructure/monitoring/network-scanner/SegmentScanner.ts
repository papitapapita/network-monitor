import { Result } from 'domain/shared/core';
import {
  AGENT_SCAN_FAILED,
  DiscoveredHost,
  IAgentHostDiscovery,
  INetworkScannerService,
  ISegmentScanner
} from 'application/device-inventory/interfaces';
import { expandCidr } from './utils/expandCidr';
import { lookupManufacturer } from './utils/lookupManufacturer';

// Server segments go to the in-process scanner, agent segments to the agent
// on them (DEV-214). The agent sends IP and MAC only: the manufacturer is
// looked up here, so the agent carries no OUI table.
export class SegmentScanner implements ISegmentScanner {
  constructor(
    private readonly serverScanner: INetworkScannerService,
    private readonly agents: IAgentHostDiscovery
  ) {}

  async scan(
    cidr: string,
    agentId: string | null
  ): Promise<Result<DiscoveredHost[]>> {
    let addresses: string[];
    try {
      addresses = expandCidr(cidr);
      if (agentId === null) {
        return Result.ok(await this.serverScanner.scan(cidr));
      }
    } catch (error) {
      return Result.fail(`Scan failed: ${(error as Error).message}`);
    }

    const answered = await this.agents.discover(agentId, cidr);
    if (answered.isFailure) {
      return Result.fail(`${AGENT_SCAN_FAILED}: ${answered.error}`);
    }
    const inSegment = new Set(addresses);
    return Result.ok(
      answered.value
        .filter((host) => inSegment.has(host.ipAddress))
        .map((host) => ({
          ipAddress: host.ipAddress,
          latencyMs: host.latencyMs ?? 0,
          macAddress: host.macAddress,
          manufacturer: lookupManufacturer(host.macAddress)
        }))
    );
  }
}
