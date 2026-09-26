import { IBankAccountRepository } from 'domain/billing/repository';
import { BankAccountId } from 'domain/shared/ids';
import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { BankAccountMapper } from '../mappers';
import {
  GetBankAccountRequestDTO,
  BankAccountResponseDTO
} from '../dtos';

export class GetBankAccountUseCase extends UseCase<
  GetBankAccountRequestDTO,
  BankAccountResponseDTO
> {
  constructor(
    private readonly bankAccountRepository: IBankAccountRepository,
    logger: ILogger
  ) {
    super(logger, 'GetBankAccountUseCase');
  }

  protected async beforeExecute(
    request: GetBankAccountRequestDTO
  ): Promise<Result<void> | null> {
    if (!request.id || request.id.trim().length === 0) {
      return Result.fail('Bank account ID is required');
    }
    return null;
  }

  protected async executeImpl(
    request: GetBankAccountRequestDTO
  ): Promise<Result<BankAccountResponseDTO>> {
    const idResult = BankAccountId.parse(request.id.trim());
    if (idResult.isFailure) {
      return this.fail(`Invalid bank account ID: ${idResult.error}`);
    }

    const findResult = await this.bankAccountRepository.findById(
      idResult.value
    );
    if (findResult.isFailure) {
      return this.fail(findResult.error!);
    }
    if (findResult.value === null) {
      return this.fail(`Bank account not found: ${request.id}`);
    }

    return this.ok(BankAccountMapper.toDTO(findResult.value));
  }
}
