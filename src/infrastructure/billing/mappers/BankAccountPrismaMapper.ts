import { Result } from 'domain/shared/core';
import { BankAccountId } from 'domain/shared/ids';
import {
  BankAccount,
  BankAccountDetails,
  BankAccountType
} from 'domain/billing';
import { BankAccountType as PrismaBankAccountType } from 'generated/prisma/client';

interface BankAccountRecord {
  id: string;
  bankName: string;
  accountType: string;
  accountNumber: string;
  createdAt: Date;
  updatedAt: Date;
}

export class BankAccountPrismaMapper {
  public static toDomain(
    raw: BankAccountRecord
  ): Result<BankAccount> {
    const idResult = BankAccountId.parse(raw.id);
    if (idResult.isFailure) {
      return Result.fail<BankAccount>(
        `Invalid bank account id: ${idResult.error}`
      );
    }

    const detailsResult = this.detailsToDomain(raw);
    if (detailsResult.isFailure) {
      return Result.fail<BankAccount>(detailsResult.error);
    }

    return Result.ok<BankAccount>(
      BankAccount.reconstitute(idResult.value, {
        details: detailsResult.value,
        createdAt: raw.createdAt,
        updatedAt: raw.updatedAt
      })
    );
  }

  public static toPersistence(bankAccount: BankAccount): {
    id: string;
    bankName: string;
    accountType: PrismaBankAccountType;
    accountNumber: string;
    createdAt: Date;
    updatedAt: Date;
  } {
    return {
      id: bankAccount.id.toString(),
      ...this.detailsToPersistence(bankAccount.details),
      createdAt: bankAccount.createdAt,
      updatedAt: bankAccount.updatedAt
    };
  }

  public static detailsToDomain(raw: {
    bankName: string;
    accountType: string;
    accountNumber: string;
  }): Result<BankAccountDetails> {
    return BankAccountDetails.create({
      bankName: raw.bankName,
      accountType: this.mapTypeFromPrisma(raw.accountType),
      accountNumber: raw.accountNumber
    });
  }

  public static detailsToPersistence(details: BankAccountDetails): {
    bankName: string;
    accountType: PrismaBankAccountType;
    accountNumber: string;
  } {
    return {
      bankName: details.bankName,
      accountType: this.mapTypeToPrisma(details.accountType),
      accountNumber: details.accountNumber
    };
  }

  // throws on unrecognised value — the repo's try/catch surfaces it as Result.fail
  private static mapTypeFromPrisma(type: string): BankAccountType {
    switch (type) {
      case 'SAVINGS':
        return BankAccountType.SAVINGS;
      case 'CHECKING':
        return BankAccountType.CHECKING;
      default:
        throw new Error(
          `Data integrity violation: unrecognised BankAccountType "${type}" in persistence store`
        );
    }
  }

  private static mapTypeToPrisma(
    type: BankAccountType
  ): PrismaBankAccountType {
    switch (type) {
      case BankAccountType.SAVINGS:
        return 'SAVINGS';
      case BankAccountType.CHECKING:
        return 'CHECKING';
      default:
        throw new Error(`Unknown domain BankAccountType: ${type}`);
    }
  }
}
