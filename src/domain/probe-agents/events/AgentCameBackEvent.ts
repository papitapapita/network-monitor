import { DomainEvent } from 'domain/shared/core';
import { AgentId } from 'domain/shared/ids';

interface AgentCameBackEventProps {
  readonly aggregateId: AgentId;
  readonly agentName: string;
  readonly offlineSince: Date;
  readonly dateTimeOccurred: Date;
}

export class AgentCameBackEvent extends DomainEvent<AgentCameBackEventProps> {
  get aggregateId(): AgentId {
    return this.props.aggregateId;
  }
  get dateTimeOccurred(): Date {
    return this.props.dateTimeOccurred;
  }
  get agentName(): string {
    return this.props.agentName;
  }
  get offlineSince(): Date {
    return this.props.offlineSince;
  }
}
