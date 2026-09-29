import { DomainEvent } from 'domain/shared/core';
import { AgentId } from 'domain/shared/ids';

interface AgentClockCorrectedEventProps {
  readonly aggregateId: AgentId;
  readonly agentName: string;
  readonly clockOffsetMs: number;
  readonly dateTimeOccurred: Date;
}

export class AgentClockCorrectedEvent extends DomainEvent<AgentClockCorrectedEventProps> {
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
