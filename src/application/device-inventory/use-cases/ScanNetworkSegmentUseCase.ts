import { Result } from 'domain/shared/core';
import { AgentId } from 'domain/shared/ids';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import {
  ScanNetworkSegmentRequestDTO,
  ScanNetworkSegmentResponseDTO
} from '../dtos';
import { DiscoverySource } from 'domain/device-inventory/enums';
import {
  IAgentAssignmentQuery,
  ISegmentScanner
} from '../interfaces';
import { DeviceSightingRecorder } from '../services';

// Shared with the controller, which answers 409 for it (DEV-171).
export const SCAN_NEEDS_SERVER_ON_SITE =
  'This server is not on the monitored network: choose an agent to scan from';
// Answered 404 (DEV-214).
export const SCAN_AGENT_NOT_FOUND = 'Agent not found';

export class ScanNetworkSegmentUseCase extends UseCase<
  ScanNetworkSegmentRequestDTO,
  ScanNetworkSegmentResponseDTO
> {
  constructor(
    private readonly scanner: ISegmentScanner,
    private readonly sightings: DeviceSightingRecorder,
    private readonly agents: IAgentAssignmentQuery,
    logger: ILogger,
    private readonly serverOnSite = true
  ) {
    super(logger, 'ScanNetworkSegmentUseCase');
  }

  protected async beforeExecute(
    request: ScanNetworkSegmentRequestDTO
  ): Promise<Result<void> | null> {
    if (!request.segment || request.segment.trim().length === 0) {
      return Result.fail('segment is required');
    }
    if (request.agentId) {
      const agentId = AgentId.parse(request.agentId);
      if (agentId.isFailure) {
        return Result.fail('agentId must be an agent id');
      }
      const check = await this.agents.check(agentId.value);
      if (check.isFailure) {
        return Result.fail(
          `Failed to check the agent: ${check.error}`
        );
      }
      return check.value === 'ASSIGNABLE'
        ? null
        : Result.fail(SCAN_AGENT_NOT_FOUND);
    }
    // A server scan sweeps from this machine: off site it would sweep the
    // hosting provider's network, not the customer's.
    if (!this.serverOnSite) {
      return Result.fail(SCAN_NEEDS_SERVER_ON_SITE);
    }
    return null;
  }

  protected async executeImpl(
    request: ScanNetworkSegmentRequestDTO
  ): Promise<Result<ScanNetworkSegmentResponseDTO>> {
    const segment = request.segment.trim();
    const agentId = request.agentId || null;

    const scanned = await this.scanner.scan(segment, agentId);
    if (scanned.isFailure) return this.fail(scanned.error);
    const hosts = scanned.value;

    const recorded = await this.sightings.record({
      source: DiscoverySource.SCAN,
      segment,
      where: segment,
      seenAt: new Date(),
      hosts
    });
    if (recorded.isFailure) return this.fail(recorded.error);
    const outcomes = recorded.value;

    return this.ok<ScanNetworkSegmentResponseDTO>({
      segment,
      agentId,
      scannedCount: this.calculateCidrHostCount(segment),
      responsiveCount: hosts.length,
      newCount: outcomes.filter((o) => o.isNew).length,
      discoveredHosts: hosts.map((h, i) => ({
        ipAddress: h.ipAddress,
        latencyMs: h.latencyMs,
        macAddress: h.macAddress,
        manufacturer: h.manufacturer,
        ...outcomes[i]
      }))
    });
  }

  private calculateCidrHostCount(cidr: string): number {
    const parts = cidr.split('/');
    if (parts.length !== 2) return 0;
    const prefix = parseInt(parts[1], 10);
    if (isNaN(prefix) || prefix < 0 || prefix > 32) return 0;
    const total = Math.pow(2, 32 - prefix);
    return prefix < 31 ? total - 2 : total;
  }
}
