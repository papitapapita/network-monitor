import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import {
  ScanNetworkSegmentRequestDTO,
  ScanNetworkSegmentResponseDTO
} from '../dtos';
import { INetworkScannerService } from '../interfaces';

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
