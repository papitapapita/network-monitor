import { DomainEvent } from 'domain/shared/core';
import { UserId } from 'domain/shared/ids';

interface UserTwoFactorResetEventProps {
  readonly aggregateId: UserId;
  readonly email: string;
  // The email of whoever ran the reset.
  readonly resetBy: string;
  readonly dateTimeOccurred: Date;
}

export class UserTwoFactorResetEvent extends DomainEvent<UserTwoFactorResetEventProps> {
  get aggregateId(): UserId {
    return this.props.aggregateId;
  }
  get dateTimeOccurred(): Date {
    return this.props.dateTimeOccurred;
  }
  get email(): string {
    return this.props.email;
  }
  get resetBy(): string {
    return this.props.resetBy;
  }
}
