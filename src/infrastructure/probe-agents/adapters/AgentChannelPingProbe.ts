import type { IAgentProbeChannel } from 'application/probe-agents/interfaces';
import type {
  AgentPingAnswer,
  IAgentPingProbe
} from 'application/device-monitoring/interfaces';

// Lets device-monitoring ping through an agent without knowing how agents
// are reached.
export class AgentChannelPingProbe implements IAgentPingProbe {
  constructor(private readonly channel: IAgentProbeChannel) {}

  async ping(
    agentId: string,
    ipAddress: string,
    attempts: number
  ): Promise<AgentPingAnswer> {
    const answer = await this.channel.ping(
      agentId,
      ipAddress,
      attempts
    );
    return answer.ok
      ? {
          kind: 'measured',
          outcome: answer.reading,
          measuredAt: answer.measuredAt
        }
      : {
          kind: 'refused',
          reason: answer.reason,
          error: answer.error
        };
  }
}
