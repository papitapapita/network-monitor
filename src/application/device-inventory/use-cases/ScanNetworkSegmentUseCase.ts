import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import {
  ScanNetworkSegmentRequestDTO,
  ScanNetworkSegmentResponseDTO
} from '../dtos';
import { INetworkScannerService } from '../interfaces';

/**
 * ScanNetworkSegmentUseCase
 *
 * Business Intent: Probe all hosts within a CIDR segment and return every
 * responsive host enriched with MAC address and manufacturer information,
 * so the operator can identify devices before deciding how to register them.
 *
 * This use case is intentionally read-only with respect to the inventory.
 * Device registration is a separate, deliberate action: the operator reviews
 * scan results (including manufacturer data), picks the correct DeviceModel
 * for each discovered host, and registers them individually via
 * CreateDeviceUseCase.
 *
 * Flow:
 * 1. beforeExecute: Validate that segment is a non-empty string.
 * 2. executeImpl:   Delegate to INetworkScannerService (ICMP ping sweep,
 *    ARP resolution, OUI manufacturer lookup) and wrap the results.
 *
 * Dependencies:
 * - INetworkScannerService: Performs the network probing.
 * - ILogger: Structured logging via the base UseCase template.
 */
export class ScanNetworkSegmentUseCase extends UseCase<
  ScanNetworkSegmentRequestDTO,
  ScanNetworkSegmentResponseDTO
> {
  constructor(
    private readonly networkScannerService: INetworkScannerService,
    logger: ILogger
  ) {
    super(logger, 'ScanNetworkSegmentUseCase');
  }

  protected async beforeExecute(
    request: ScanNetworkSegmentRequestDTO
  ): Promise<Result<void> | null> {
    if (!request.segment || request.segment.trim().length === 0) {
      return Result.fail('segment is required');
    }
    return null;
  }

  protected async executeImpl(
    request: ScanNetworkSegmentRequestDTO
  ): Promise<Result<ScanNetworkSegmentResponseDTO>> {
    const segment = request.segment.trim();

    const hosts = await this.networkScannerService.scan(segment);

    return this.ok<ScanNetworkSegmentResponseDTO>({
      segment,
      scannedCount: this.calculateCidrHostCount(segment),
      responsiveCount: hosts.length,
      discoveredHosts: hosts.map((h) => ({
        ipAddress: h.ipAddress,
        latencyMs: h.latencyMs,
        macAddress: h.macAddress,
        manufacturer: h.manufacturer
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
