import { BankAccountId } from 'domain/shared/ids';
import { Result } from 'domain/shared/core';
import { BankAccount } from '../aggregates';

export interface IBankAccountRepository {
  save(bankAccount: BankAccount): Promise<Result<BankAccount>>;
  findById(id: BankAccountId): Promise<Result<BankAccount | null>>;
  findAll(): Promise<Result<BankAccount[]>>;
  delete(id: BankAccountId): Promise<Result<void>>;
}
