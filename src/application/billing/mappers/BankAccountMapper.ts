import {
  BankAccount,
  BankAccountDetails,
  BankAccountType
} from 'domain/billing';
import {
  BankAccountResponseDTO,
  BankAccountListResponseDTO,
  PaymentAccountDTO
} from '../dtos';

const ACCOUNT_TYPE_LABELS: Record<BankAccountType, string> = {
  [BankAccountType.SAVINGS]: 'Ahorros',
  [BankAccountType.CHECKING]: 'Corriente'
};

export class BankAccountMapper {
  public static toDTO(
    bankAccount: BankAccount
  ): BankAccountResponseDTO {
    return {
      id: bankAccount.id.toString(),
      ...this.toPaymentAccountDTO(bankAccount.details),
      createdAt: bankAccount.createdAt.toISOString(),
      updatedAt: bankAccount.updatedAt.toISOString()
    };
  }

  public static toListDTO(
    bankAccounts: BankAccount[]
  ): BankAccountListResponseDTO {
    return { bankAccounts: bankAccounts.map((b) => this.toDTO(b)) };
  }

  public static toPaymentAccountDTO(
    details: BankAccountDetails
  ): PaymentAccountDTO {
    return {
      bankName: details.bankName,
      accountType: details.accountType,
      accountNumber: details.accountNumber,
      label: `${details.bankName} · ${ACCOUNT_TYPE_LABELS[details.accountType]} · ${details.accountNumber}`
    };
  }

  public static parseAccountType(
    raw: string
  ): BankAccountType | null {
    const normalized = raw.trim().toUpperCase();
    return Object.values(BankAccountType).includes(
      normalized as BankAccountType
    )
      ? (normalized as BankAccountType)
      : null;
  }
}
