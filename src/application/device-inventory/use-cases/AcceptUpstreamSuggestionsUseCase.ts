import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import { IDeviceRepository } from 'domain/device-inventory/repository';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import {
  AcceptUpstreamSuggestionsRequestDTO,
  AcceptUpstreamSuggestionsResponseDTO,
  UpstreamLinkRequestDTO,
  UpstreamLinkResultDTO
} from '../dtos';
import { UpstreamAssignment } from '../services';

export const MAX_UPSTREAM_LINKS_PER_REQUEST = 500;

// DEV-194: each chosen link goes through the same rules as a single edit
// (DEV-181..183), one after another, so a later link is judged against the
// ones already made. One refused link does not stop the rest.
export class AcceptUpstreamSuggestionsUseCase extends UseCase<
  AcceptUpstreamSuggestionsRequestDTO,
  AcceptUpstreamSuggestionsResponseDTO
> {
  constructor(
    private readonly deviceRepository: IDeviceRepository,
    logger: ILogger,
    private readonly upstreamAssignment: UpstreamAssignment = new UpstreamAssignment(
      deviceRepository
    )
  ) {
    super(logger, 'AcceptUpstreamSuggestionsUseCase');
  }

  protected async beforeExecute(
    request: AcceptUpstreamSuggestionsRequestDTO
  ): Promise<Result<void> | null> {
    if (!Array.isArray(request.links) || request.links.length === 0) {
      return Result.fail('At least one link is required');
    }
    if (request.links.length > MAX_UPSTREAM_LINKS_PER_REQUEST) {
      return Result.fail(
        `At most ${MAX_UPSTREAM_LINKS_PER_REQUEST} links can be accepted at once`
      );
    }
    const deviceIds = new Set(request.links.map((l) => l.deviceId));
    if (deviceIds.size !== request.links.length) {
      return Result.fail(
        'Each device can appear only once in a request'
      );
    }
    return null;
  }

  protected async executeImpl(
    request: AcceptUpstreamSuggestionsRequestDTO
  ): Promise<Result<AcceptUpstreamSuggestionsResponseDTO>> {
    const results: UpstreamLinkResultDTO[] = [];
    for (const link of request.links) {
      results.push(await this.apply(link));
    }
    return this.ok({
      results,
      linked: results.filter((r) => r.outcome === 'LINKED').length,
      failed: results.filter((r) => r.outcome === 'FAILED').length
    });
  }

  private async apply(
    link: UpstreamLinkRequestDTO
  ): Promise<UpstreamLinkResultDTO> {
    const failed = (error: string): UpstreamLinkResultDTO => ({
      deviceId: link.deviceId,
      upstreamDeviceId: link.upstreamDeviceId,
      outcome: 'FAILED',
      error
    });

    const deviceId = DeviceId.parse(link.deviceId);
    if (deviceId.isFailure) {
      return failed(`Invalid device ID: ${deviceId.error}`);
    }
    const found = await this.deviceRepository.findById(
      deviceId.value
    );
    if (found.isFailure) return failed(found.error!);
    if (found.value === null) {
      return failed(`Device not found: ${link.deviceId}`);
    }
    const device = found.value;

    if (
      device.upstreamDeviceId?.toString() === link.upstreamDeviceId
    ) {
      return {
        deviceId: link.deviceId,
        upstreamDeviceId: link.upstreamDeviceId,
        outcome: 'UNCHANGED',
        error: null
      };
    }

    const upstream = await this.upstreamAssignment.resolve(
      device,
      link.upstreamDeviceId
    );
    if (upstream.isFailure) return failed(upstream.error);

    const set = device.setUpstream(upstream.value);
    if (set.isFailure) return failed(set.error!);

    const saved = await this.deviceRepository.save(device);
    if (saved.isFailure) {
      return failed(`Failed to persist device: ${saved.error}`);
    }
    return {
      deviceId: link.deviceId,
      upstreamDeviceId: link.upstreamDeviceId,
      outcome: 'LINKED',
      error: null
    };
  }
}
