import { ValueObject, Result, Guard } from 'domain/shared/core';
import { BankAccountType } from '../enums';

const MAX_BANK_NAME_LENGTH = 100;
const ACCOUNT_NUMBER_PATTERN = /^\d[\d -]{2,28}\d$/;

interface BankAccountDetailsProps {
  readonly bankName: string;
  readonly accountType: BankAccountType;
  readonly accountNumber: string;
}

export class BankAccountDetails extends ValueObject<BankAccountDetailsProps> {
  private constructor(props: BankAccountDetailsProps) {
    super(props);
  }

  get bankName(): string {
    return this._props.bankName;
  }

  get accountType(): BankAccountType {
    return this._props.accountType;
  }

  get accountNumber(): string {
    return this._props.accountNumber;
  }

  public static create(
    props: BankAccountDetailsProps
  ): Result<BankAccountDetails> {
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(props.bankName, 'bankName'),
      Guard.isString(props.bankName, 'bankName'),
      Guard.againstNullOrUndefined(props.accountType, 'accountType'),
      Guard.againstNullOrUndefined(
        props.accountNumber,
        'accountNumber'
      ),
      Guard.isString(props.accountNumber, 'accountNumber')
    ]);
    if (!guardResult.succeeded) {
      return Result.fail<BankAccountDetails>(guardResult.message!);
    }

    const bankName = props.bankName.trim();
    if (bankName.length === 0) {
      return Result.fail<BankAccountDetails>(
        'bankName cannot be empty'
      );
    }
    if (bankName.length > MAX_BANK_NAME_LENGTH) {
      return Result.fail<BankAccountDetails>(
        `bankName cannot exceed ${MAX_BANK_NAME_LENGTH} characters`
      );
    }

    if (!Object.values(BankAccountType).includes(props.accountType)) {
      return Result.fail<BankAccountDetails>(
        `Invalid accountType "${props.accountType}"`
      );
    }

    const accountNumber = props.accountNumber.trim();
    if (!ACCOUNT_NUMBER_PATTERN.test(accountNumber)) {
      return Result.fail<BankAccountDetails>(
        'accountNumber must be 4 to 30 digits, optionally separated by spaces or dashes'
      );
    }

    return Result.ok<BankAccountDetails>(
      new BankAccountDetails({
        bankName,
        accountType: props.accountType,
        accountNumber
      })
    );
  }
}
