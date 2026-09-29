import { DomainEvent } from 'domain/shared/core';
import { AgentId } from 'domain/shared/ids';

interface AgentClockDriftedEventProps {
  readonly aggregateId: AgentId;
  readonly agentName: string;
  // The agent's clock minus ours; positive when the agent runs ahead.
  readonly clockOffsetMs: number;
  readonly dateTimeOccurred: Date;
}

export class AgentClockDriftedEvent extends DomainEvent<AgentClockDriftedEventProps> {
  get aggregateId(): AgentId {
    return this.props.aggregateId;
  }
  get dateTimeOccurred(): Date {
    return this.props.dateTimeOccurred;
  }
  get agentName(): string {
    return this.props.agentName;
  }
  get clockOffsetMs(): number {
    return this.props.clockOffsetMs;
  }
}
