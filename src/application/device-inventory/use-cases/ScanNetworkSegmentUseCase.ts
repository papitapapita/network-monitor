import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import {
  ScanNetworkSegmentRequestDTO,
  ScanNetworkSegmentResponseDTO
} from '../dtos';
import { INetworkScannerService } from '../interfaces';

// Shared with the controller, which answers 409 for it (DEV-171).
export const SCAN_NEEDS_SERVER_ON_SITE =
  'Network scan is not available — this server is not on the monitored network';

export class ScanNetworkSegmentUseCase extends UseCase<
  ScanNetworkSegmentRequestDTO,
  ScanNetworkSegmentResponseDTO
> {
  constructor(
    private readonly networkScannerService: INetworkScannerService,
    logger: ILogger,
    private readonly serverOnSite = true
  ) {
    super(logger, 'ScanNetworkSegmentUseCase');
  }

  protected async beforeExecute(
    request: ScanNetworkSegmentRequestDTO
  ): Promise<Result<void> | null> {
    // The scan sweeps from this machine: off site it would sweep the
    // hosting provider's network, not the customer's.
    if (!this.serverOnSite) {
      return Result.fail(SCAN_NEEDS_SERVER_ON_SITE);
    }
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
