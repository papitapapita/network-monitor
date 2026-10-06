import { BillId, UserId } from 'domain/shared/ids';
import { Money } from 'domain/shared/value-objects';
import { BillPayment, PaymentMethod } from 'domain/billing';
import { IBillRepository } from 'domain/billing/repository';
import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { BillMapper } from '../mappers';
import { MarkBillPaidRequestDTO, BillResponseDTO } from '../dtos';

// BIL-300: paying a bill records how, by whom and when it was paid.
export class MarkBillPaidUseCase extends UseCase<
  MarkBillPaidRequestDTO,
  BillResponseDTO
> {
  constructor(
    private readonly billRepository: IBillRepository,
    logger: ILogger
  ) {
    super(logger, 'MarkBillPaidUseCase');
  }

  protected async beforeExecute(
    request: MarkBillPaidRequestDTO
  ): Promise<Result<void> | null> {
    if (!request.id || request.id.trim().length === 0) {
      return Result.fail('Bill ID is required');
    }
    return null;
  }

  protected async executeImpl(
    request: MarkBillPaidRequestDTO
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

    const paymentResult = this.buildPayment(request, bill.total);
    if (paymentResult.isFailure) {
      return this.fail(paymentResult.error!);
    }

    const recordResult = bill.recordPayment(paymentResult.value);
    if (recordResult.isFailure) {
      return this.fail(recordResult.error!);
    }

    const saveResult = await this.billRepository.save(bill);
    if (saveResult.isFailure) {
      return this.fail(`Failed to persist bill: ${saveResult.error}`);
    }

    return this.ok(BillMapper.toDTO(saveResult.value));
  }

  private buildPayment(
    request: MarkBillPaidRequestDTO,
    total: Money
  ): Result<BillPayment> {
    let amount = total;
    if (request.amount !== undefined) {
      const amountResult = Money.create(request.amount);
      if (amountResult.isFailure) {
        return Result.fail(
          `Invalid payment amount: ${amountResult.error}`
        );
      }
      amount = amountResult.value;
    }

    let paidAt = new Date();
    if (request.paidAt !== undefined) {
      paidAt = new Date(request.paidAt);
      if (isNaN(paidAt.getTime())) {
        return Result.fail('Invalid payment date: not a valid date');
      }
    }

    let recordedBy: UserId | null = null;
    if (request.recordedByUserId !== undefined) {
      const userIdResult = UserId.parse(request.recordedByUserId);
      if (userIdResult.isFailure) {
        return Result.fail(
          `Invalid recordedByUserId: ${userIdResult.error}`
        );
      }
      recordedBy = userIdResult.value;
    }

    return BillPayment.create({
      method: request.method as PaymentMethod,
      reference: request.reference ?? null,
      amount,
      paidAt,
      recordedBy
    });
  }
}
