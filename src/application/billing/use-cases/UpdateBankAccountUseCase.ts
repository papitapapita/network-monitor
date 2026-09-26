import { BankAccountDetails } from 'domain/billing';
import { IBankAccountRepository } from 'domain/billing/repository';
import { BankAccountId } from 'domain/shared/ids';
import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { BankAccountMapper } from '../mappers';
import {
  UpdateBankAccountRequestDTO,
  BankAccountResponseDTO
} from '../dtos';

export class UpdateBankAccountUseCase extends UseCase<
  UpdateBankAccountRequestDTO,
  BankAccountResponseDTO
> {
  constructor(
    private readonly bankAccountRepository: IBankAccountRepository,
    logger: ILogger
  ) {
    super(logger, 'UpdateBankAccountUseCase');
  }

  protected async beforeExecute(
    request: UpdateBankAccountRequestDTO
  ): Promise<Result<void> | null> {
    if (!request.id || request.id.trim().length === 0) {
      return Result.fail('Bank account ID is required');
    }
    return null;
  }

  protected async executeImpl(
    request: UpdateBankAccountRequestDTO
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
    const bankAccount = findResult.value;

    let accountType = bankAccount.accountType;
    if (request.accountType !== undefined) {
      const parsed = BankAccountMapper.parseAccountType(
        request.accountType
      );
      if (parsed === null) {
        return this.fail(
          `Invalid accountType "${request.accountType}"`
        );
      }
      accountType = parsed;
    }

    const detailsResult = BankAccountDetails.create({
      bankName: request.bankName ?? bankAccount.bankName,
      accountType,
      accountNumber:
        request.accountNumber ?? bankAccount.accountNumber
    });
    if (detailsResult.isFailure) {
      return this.fail(detailsResult.error!);
    }

    const updateResult = bankAccount.updateDetails(
      detailsResult.value
    );
    if (updateResult.isFailure) {
      return this.fail(updateResult.error!);
    }

    const saveResult =
      await this.bankAccountRepository.save(bankAccount);
    if (saveResult.isFailure) {
      return this.fail(saveResult.error!);
    }

    return this.ok(BankAccountMapper.toDTO(saveResult.value));
  }
}
