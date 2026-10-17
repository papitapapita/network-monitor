import type { IAgentProbeChannel } from 'application/probe-agents/interfaces';
import type {
  AgentSweepAnswer,
  IAgentSweepProbe
} from 'application/device-monitoring/interfaces';

// Lets the network sweep ping through an agent without knowing how agents
// are reached.
export class AgentChannelSweepProbe implements IAgentSweepProbe {
  constructor(private readonly channel: IAgentProbeChannel) {}

  async sweep(
    agentId: string,
    ipAddresses: string[],
    attempts: number
  ): Promise<AgentSweepAnswer> {
    const answer = await this.channel.sweep(
      agentId,
      ipAddresses,
      attempts
    );
    return answer.ok
      ? { kind: 'measured', outcomes: answer.reading }
      : {
          kind: 'refused',
          reason: answer.reason,
          error: answer.error
        };
  }
}
