import { Result } from 'domain/shared/core';
import { AlertId } from 'domain/shared/ids';
import { IAlertRepository } from 'domain/notifications/repository';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { DeleteAlertDTO } from '../dtos';

export class DeleteAlertUseCase extends UseCase<
  DeleteAlertDTO,
  void
> {
  constructor(
    private readonly alertRepository: IAlertRepository,
    logger: ILogger
  ) {
    super(logger, 'DeleteAlertUseCase');
  }

  protected async executeImpl(
    request: DeleteAlertDTO
  ): Promise<Result<void>> {
    const idResult = AlertId.parse(request.id);
    if (idResult.isFailure) {
      return this.fail(`Invalid alert ID: ${idResult.error}`);
    }

    const found = await this.alertRepository.findById(idResult.value);
    if (found.isFailure) {
      return this.fail(`Failed to load alert: ${found.error}`);
    }
    if (found.value === null) {
      return this.fail('Alert not found');
    }
    if (found.value.isOpen) {
      return this.fail('Cannot delete an alert that is still open');
    }

    const deleteResult = await this.alertRepository.deleteById(
      idResult.value
    );
    if (deleteResult.isFailure) {
      return this.fail(
        `Failed to delete alert: ${deleteResult.error}`
      );
    }

    return this.ok(undefined);
  }
}
