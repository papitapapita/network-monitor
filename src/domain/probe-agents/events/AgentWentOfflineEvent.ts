import { DomainEvent } from 'domain/shared/core';
import { AgentId } from 'domain/shared/ids';

interface AgentWentOfflineEventProps {
  readonly aggregateId: AgentId;
  readonly agentName: string;
  // Last contact, or enrollment for an agent that never reported in.
  readonly silentSince: Date;
  readonly dateTimeOccurred: Date;
}

export class AgentWentOfflineEvent extends DomainEvent<AgentWentOfflineEventProps> {
  get aggregateId(): AgentId {
    return this.props.aggregateId;
  }
  get dateTimeOccurred(): Date {
    return this.props.dateTimeOccurred;
  }
  get agentName(): string {
    return this.props.agentName;
  }
  get silentSince(): Date {
    return this.props.silentSince;
  }
}
