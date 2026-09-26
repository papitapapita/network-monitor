import { AggregateRoot, Result, Guard } from 'domain/shared/core';
import { BankAccountId } from 'domain/shared/ids';
import { BankAccountType } from '../enums';
import { BankAccountProps } from '../props';
import { BankAccountDetails } from '../value-objects';

export class BankAccount extends AggregateRoot<
  BankAccountProps,
  BankAccountId
> {
  private constructor(props: BankAccountProps, id: BankAccountId) {
    super(props, id);
  }

  get details(): BankAccountDetails {
    return this.props.details;
  }

  get bankName(): string {
    return this.props.details.bankName;
  }

  get accountType(): BankAccountType {
    return this.props.details.accountType;
  }

  get accountNumber(): string {
    return this.props.details.accountNumber;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  public static create(
    details: BankAccountDetails
  ): Result<BankAccount> {
    const now = new Date();
    const state: BankAccountProps = {
      details,
      createdAt: now,
      updatedAt: now
    };

    const validationResult = BankAccount.validate(state);
    if (validationResult.isFailure) {
      return Result.fail<BankAccount>(validationResult.error);
    }

    return Result.ok<BankAccount>(
      new BankAccount(state, BankAccountId.create())
    );
  }

  // bypasses validation — for repository use only
  public static reconstitute(
    id: BankAccountId,
    props: BankAccountProps
  ): BankAccount {
    return new BankAccount(props, id);
  }

  public updateDetails(details: BankAccountDetails): Result<void> {
    const candidate: BankAccountProps = {
      ...this.props,
      details,
      updatedAt: new Date()
    };

    const validationResult = BankAccount.validate(candidate);
    if (validationResult.isFailure) {
      return Result.fail<void>(validationResult.error);
    }

    this.props = candidate;
    return Result.ok<void>();
  }

  private static validate(state: BankAccountProps): Result<void> {
    const guardResult = Guard.againstNullOrUndefined(
      state.details,
      'details'
    );
    if (!guardResult.succeeded) {
      return Result.fail<void>(guardResult.message!);
    }
    return Result.ok<void>();
  }
}
