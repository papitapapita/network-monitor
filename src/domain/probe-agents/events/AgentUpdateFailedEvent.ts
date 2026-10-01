import { DomainEvent } from 'domain/shared/core';
import { AgentId } from 'domain/shared/ids';
import { AgentUpdateOutcome } from '../enums';

interface AgentUpdateFailedEventProps {
  readonly aggregateId: AgentId;
  readonly agentName: string;
  // The version the agent still runs.
  readonly runningVersion: string | null;
  // The version it failed to move to.
  readonly targetVersion: string;
  readonly outcome: AgentUpdateOutcome;
  readonly reason: string;
  readonly dateTimeOccurred: Date;
}

export class AgentUpdateFailedEvent extends DomainEvent<AgentUpdateFailedEventProps> {
  get aggregateId(): AgentId {
    return this.props.aggregateId;
  }
  get dateTimeOccurred(): Date {
    return this.props.dateTimeOccurred;
  }
  get agentName(): string {
    return this.props.agentName;
  }
  get runningVersion(): string | null {
    return this.props.runningVersion;
  }
  get targetVersion(): string {
    return this.props.targetVersion;
  }
  get outcome(): AgentUpdateOutcome {
    return this.props.outcome;
  }
  get reason(): string {
    return this.props.reason;
  }
}
