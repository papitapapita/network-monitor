import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { ILinkDiagnosisRunner } from '../interfaces';
import { LinkDiagnosisRequestDTO, LinkDiagnosisDTO } from '../dtos';

export class GetLinkDiagnosisUseCase extends UseCase<
  LinkDiagnosisRequestDTO,
  LinkDiagnosisDTO
> {
  constructor(
    private readonly runner: ILinkDiagnosisRunner,
    logger: ILogger
  ) {
    super(logger, 'GetLinkDiagnosisUseCase');
  }

  protected async beforeExecute(
    request: LinkDiagnosisRequestDTO
  ): Promise<Result<void> | null> {
    if (!request.deviceId?.trim()) {
      return Result.fail('Device ID is required');
    }
    return null;
  }

  protected async executeImpl(
    request: LinkDiagnosisRequestDTO
  ): Promise<Result<LinkDiagnosisDTO>> {
    const deviceIdResult = DeviceId.parse(request.deviceId);
    if (deviceIdResult.isFailure) {
      return this.fail(`Invalid device ID: ${deviceIdResult.error}`);
    }

    const diagnosis = this.runner.find(
      deviceIdResult.value.toString()
    );
    if (!diagnosis) {
      return this.fail('Diagnosis not found for device');
    }
    return this.ok(diagnosis);
  }

  // the samples array is up to several hundred entries
  protected sanitizeForLogging(data: unknown): unknown {
    if (data && typeof data === 'object' && 'samples' in data) {
      const { samples: _samples, ...rest } = data as LinkDiagnosisDTO;
      return rest;
    }
    return data;
  }
}
