import { BillId } from 'domain/shared/ids';
import { IBillRepository } from 'domain/billing/repository';
import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { BillMapper } from '../mappers';
import { CancelBillRequestDTO, BillResponseDTO } from '../dtos';

export class CancelBillUseCase extends UseCase<
  CancelBillRequestDTO,
  BillResponseDTO
> {
  constructor(
    private readonly billRepository: IBillRepository,
    logger: ILogger
  ) {
    super(logger, 'CancelBillUseCase');
  }

  protected async beforeExecute(
    request: CancelBillRequestDTO
  ): Promise<Result<void> | null> {
    if (!request.id || request.id.trim().length === 0) {
      return Result.fail('Bill ID is required');
    }
    return null;
  }

  protected async executeImpl(
    request: CancelBillRequestDTO
  ): Promise<Result<BillResponseDTO>> {
    const idResult = BillId.parse(request.id.trim());
    if (idResult.isFailure) {
      return this.fail(`Invalid bill ID: ${idResult.error}`);
    }

    const findResult = await this.billRepository.findById(
      idResult.value
    );
    if (findResult.isFailure) {
      return this.fail(findResult.error!);
    }
    if (findResult.value === null) {
      return this.fail(`Bill not found: ${request.id}`);
    }

    const bill = findResult.value;
    const cancelResult = bill.cancel();
    if (cancelResult.isFailure) {
      return this.fail(cancelResult.error!);
    }

    const saveResult = await this.billRepository.save(bill);
    if (saveResult.isFailure) {
      return this.fail(`Failed to persist bill: ${saveResult.error}`);
    }

    return this.ok(BillMapper.toDTO(saveResult.value));
  }
}
