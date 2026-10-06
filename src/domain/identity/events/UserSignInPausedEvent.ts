import { DomainEvent } from 'domain/shared/core';
import { UserId } from 'domain/shared/ids';

interface UserSignInPausedEventProps {
  readonly aggregateId: UserId;
  readonly email: string;
  readonly failedSignIns: number;
  readonly pausedUntil: Date;
  // Where the attempt that started the pause came from; null when the
  // caller's address is unknown.
  readonly sourceIp: string | null;
  readonly dateTimeOccurred: Date;
}

export class UserSignInPausedEvent extends DomainEvent<UserSignInPausedEventProps> {
  get aggregateId(): UserId {
    return this.props.aggregateId;
  }
  get dateTimeOccurred(): Date {
    return this.props.dateTimeOccurred;
  }
  get email(): string {
    return this.props.email;
  }
  get failedSignIns(): number {
    return this.props.failedSignIns;
  }
  get pausedUntil(): Date {
    return this.props.pausedUntil;
  }
  get sourceIp(): string | null {
    return this.props.sourceIp;
  }
}
