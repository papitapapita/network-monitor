import { PrismaClient } from 'generated/prisma/client';
import { BankAccount } from 'domain/billing';
import { IBankAccountRepository } from 'domain/billing/repository';
import { BankAccountId } from 'domain/shared/ids';
import { Result } from 'domain/shared/core';
import { BankAccountPrismaMapper } from '../mappers';
import {
  isRecordNotFound,
  isUniqueViolation
} from '../../persistence/prisma-errors';

export class PrismaBankAccountRepository
  implements IBankAccountRepository
{
  constructor(private readonly prisma: PrismaClient) {}

  public async save(
    bankAccount: BankAccount
  ): Promise<Result<BankAccount>> {
    try {
      const data = BankAccountPrismaMapper.toPersistence(bankAccount);

      const raw = await this.prisma.bankAccount.upsert({
        where: { id: data.id },
        create: data,
        update: {
          bankName: data.bankName,
          accountType: data.accountType,
          accountNumber: data.accountNumber,
          updatedAt: data.updatedAt
        }
      });

      const domainResult = BankAccountPrismaMapper.toDomain(raw);
      if (domainResult.isFailure) {
        return Result.fail<BankAccount>(
          `Failed to map bank account: ${domainResult.error}`
        );
      }
      return Result.ok<BankAccount>(domainResult.value);
    } catch (error) {
      if (isUniqueViolation(error)) {
        return Result.fail<BankAccount>(
          `A bank account with number ${bankAccount.accountNumber} at ${bankAccount.bankName} already exists`
        );
      }
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<BankAccount>(
        `Database error saving bank account: ${errorMessage}`
      );
    }
  }

  public async findById(
    id: BankAccountId
  ): Promise<Result<BankAccount | null>> {
    try {
      const raw = await this.prisma.bankAccount.findUnique({
        where: { id: id.toString() }
      });
      if (!raw) return Result.ok<BankAccount | null>(null);

      const domainResult = BankAccountPrismaMapper.toDomain(raw);
      if (domainResult.isFailure) {
        return Result.fail<BankAccount | null>(
          `Failed to map bank account: ${domainResult.error}`
        );
      }
      return Result.ok<BankAccount | null>(domainResult.value);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<BankAccount | null>(
        `Database error finding bank account: ${errorMessage}`
      );
    }
  }

  public async findAll(): Promise<Result<BankAccount[]>> {
    try {
      const rawRecords = await this.prisma.bankAccount.findMany({
        orderBy: { createdAt: 'asc' }
      });

      const bankAccounts: BankAccount[] = [];
      for (const raw of rawRecords) {
        const domainResult = BankAccountPrismaMapper.toDomain(raw);
        if (domainResult.isFailure) {
          return Result.fail<BankAccount[]>(
            `Failed to map bank account: ${domainResult.error}`
          );
        }
        bankAccounts.push(domainResult.value);
      }
      return Result.ok<BankAccount[]>(bankAccounts);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<BankAccount[]>(
        `Database error finding bank accounts: ${errorMessage}`
      );
    }
  }

  public async delete(id: BankAccountId): Promise<Result<void>> {
    try {
      await this.prisma.bankAccount.delete({
        where: { id: id.toString() }
      });
      return Result.ok<void>();
    } catch (error) {
      if (isRecordNotFound(error)) {
        return Result.fail<void>(
          `Bank account not found: ${id.toString()}`
        );
      }
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<void>(
        `Database error deleting bank account: ${errorMessage}`
      );
    }
  }
}
