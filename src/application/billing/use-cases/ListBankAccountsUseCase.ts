import { IBankAccountRepository } from 'domain/billing/repository';
import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { BankAccountMapper } from '../mappers';
import { BankAccountListResponseDTO } from '../dtos';

export class ListBankAccountsUseCase extends UseCase<
  void,
  BankAccountListResponseDTO
> {
  constructor(
    private readonly bankAccountRepository: IBankAccountRepository,
    logger: ILogger
  ) {
    super(logger, 'ListBankAccountsUseCase');
  }

  protected async executeImpl(): Promise<
    Result<BankAccountListResponseDTO>
  > {
    const findResult = await this.bankAccountRepository.findAll();
    if (findResult.isFailure) {
      return this.fail(findResult.error!);
    }
    return this.ok(BankAccountMapper.toListDTO(findResult.value));
  }
}
