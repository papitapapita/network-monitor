import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { ILinkDiagnosisRunner } from '../interfaces';
import { LinkDiagnosisRequestDTO, LinkDiagnosisDTO } from '../dtos';

export class StopLinkDiagnosisUseCase extends UseCase<
  LinkDiagnosisRequestDTO,
  LinkDiagnosisDTO
> {
  constructor(
    private readonly runner: ILinkDiagnosisRunner,
    logger: ILogger
  ) {
    super(logger, 'StopLinkDiagnosisUseCase');
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

    const diagnosis = this.runner.stop(
      deviceIdResult.value.toString()
    );
    if (!diagnosis) {
      return this.fail('Running diagnosis not found for device');
    }
    return this.ok(diagnosis);
  }
}
