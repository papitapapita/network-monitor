import { Result } from 'domain/shared/core';
import {
  IAlertRecorder,
  AlertRecordInput
} from 'application/shared/interfaces';
import {
  OpenAlertUseCase,
  ResolveAlertUseCase
} from 'application/notifications/use-cases';

export class AlertRecorder implements IAlertRecorder {
  constructor(
    private readonly openAlertUseCase: OpenAlertUseCase,
    private readonly resolveAlertUseCase: ResolveAlertUseCase
  ) {}

  async open(input: AlertRecordInput): Promise<Result<void>> {
    const result = await this.openAlertUseCase.execute({
      deviceId: input.deviceId,
      severity: input.severity,
      source: input.source,
      type: input.type,
      description: input.description,
      details: input.details,
      skipTicket: input.skipTicket
    });
    return result.isFailure ? Result.fail(result.error) : Result.ok();
  }

  async resolve(
    deviceId: string,
    type: string,
    resolvedAt: Date
  ): Promise<Result<void>> {
    const result = await this.resolveAlertUseCase.execute({
      deviceId,
      type,
      resolvedAt
    });
    return result.isFailure ? Result.fail(result.error) : Result.ok();
  }
}
