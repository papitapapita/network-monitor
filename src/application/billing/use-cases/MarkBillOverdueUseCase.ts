import { BillId } from 'domain/shared/ids';
import { IBillRepository } from 'domain/billing/repository';
import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { BillMapper } from '../mappers';
import { MarkBillOverdueRequestDTO, BillResponseDTO } from '../dtos';

export class MarkBillOverdueUseCase extends UseCase<
  MarkBillOverdueRequestDTO,
  BillResponseDTO
> {
  constructor(
    private readonly billRepository: IBillRepository,
    logger: ILogger
  ) {
    super(logger, 'MarkBillOverdueUseCase');
  }

  protected async beforeExecute(
    request: MarkBillOverdueRequestDTO
  ): Promise<Result<void> | null> {
    if (!request.id || request.id.trim().length === 0) {
      return Result.fail('Bill ID is required');
    }
    return null;
  }

  protected async executeImpl(
    request: MarkBillOverdueRequestDTO
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
    const overdueResult = bill.markOverdue();
    if (overdueResult.isFailure) {
      return this.fail(overdueResult.error!);
    }

    const saveResult = await this.billRepository.save(bill);
    if (saveResult.isFailure) {
      return this.fail(`Failed to persist bill: ${saveResult.error}`);
    }

    return this.ok(BillMapper.toDTO(saveResult.value));
  }
}
