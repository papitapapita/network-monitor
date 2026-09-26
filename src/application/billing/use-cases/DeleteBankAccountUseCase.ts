import { IBankAccountRepository } from 'domain/billing/repository';
import { BankAccountId } from 'domain/shared/ids';
import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { DeleteBankAccountRequestDTO } from '../dtos';

export class DeleteBankAccountUseCase extends UseCase<
  DeleteBankAccountRequestDTO,
  void
> {
  constructor(
    private readonly bankAccountRepository: IBankAccountRepository,
    logger: ILogger
  ) {
    super(logger, 'DeleteBankAccountUseCase');
  }

  protected async beforeExecute(
    request: DeleteBankAccountRequestDTO
  ): Promise<Result<void> | null> {
    if (!request.id || request.id.trim().length === 0) {
      return Result.fail('Bank account ID is required');
    }
    return null;
  }

  // Issued cuentas de cobro hold their own copy of the account, so nothing
  // references this row and deleting it is always safe.
  protected async executeImpl(
    request: DeleteBankAccountRequestDTO
  ): Promise<Result<void>> {
    const idResult = BankAccountId.parse(request.id.trim());
    if (idResult.isFailure) {
      return this.fail(`Invalid bank account ID: ${idResult.error}`);
    }

    const deleteResult = await this.bankAccountRepository.delete(
      idResult.value
    );
    if (deleteResult.isFailure) {
      return this.fail(deleteResult.error!);
    }

    return this.ok(undefined);
  }
}
