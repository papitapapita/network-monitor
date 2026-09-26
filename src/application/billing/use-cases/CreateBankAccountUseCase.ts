import { BankAccount, BankAccountDetails } from 'domain/billing';
import { IBankAccountRepository } from 'domain/billing/repository';
import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { BankAccountMapper } from '../mappers';
import {
  CreateBankAccountRequestDTO,
  BankAccountResponseDTO
} from '../dtos';

export class CreateBankAccountUseCase extends UseCase<
  CreateBankAccountRequestDTO,
  BankAccountResponseDTO
> {
  constructor(
    private readonly bankAccountRepository: IBankAccountRepository,
    logger: ILogger
  ) {
    super(logger, 'CreateBankAccountUseCase');
  }

  protected async beforeExecute(
    request: CreateBankAccountRequestDTO
  ): Promise<Result<void> | null> {
    if (!request.bankName || !request.accountNumber) {
      return Result.fail('bankName and accountNumber are required');
    }
    if (!request.accountType) {
      return Result.fail('accountType is required');
    }
    return null;
  }

  protected async executeImpl(
    request: CreateBankAccountRequestDTO
  ): Promise<Result<BankAccountResponseDTO>> {
    const accountType = BankAccountMapper.parseAccountType(
      request.accountType
    );
    if (accountType === null) {
      return this.fail(
        `Invalid accountType "${request.accountType}"`
      );
    }

    const detailsResult = BankAccountDetails.create({
      bankName: request.bankName,
      accountType,
      accountNumber: request.accountNumber
    });
    if (detailsResult.isFailure) {
      return this.fail(detailsResult.error!);
    }

    const bankAccountResult = BankAccount.create(detailsResult.value);
    if (bankAccountResult.isFailure) {
      return this.fail(bankAccountResult.error!);
    }

    const saveResult = await this.bankAccountRepository.save(
      bankAccountResult.value
    );
    if (saveResult.isFailure) {
      return this.fail(saveResult.error!);
    }

    return this.ok(BankAccountMapper.toDTO(saveResult.value));
  }
}
