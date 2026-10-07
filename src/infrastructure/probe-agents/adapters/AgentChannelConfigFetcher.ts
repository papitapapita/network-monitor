import type { IAgentProbeChannel } from 'application/probe-agents/interfaces';
import type {
  AgentConfigAnswer,
  AgentConfigFetchRequest,
  IAgentConfigFetcher
} from 'application/device-backups/interfaces';

// Lets device-backups read a configuration through an agent without knowing
// how agents are reached.
export class AgentChannelConfigFetcher
  implements IAgentConfigFetcher
{
  constructor(private readonly channel: IAgentProbeChannel) {}

  async fetch(
    agentId: string,
    request: AgentConfigFetchRequest
  ): Promise<AgentConfigAnswer> {
    const answer = await this.channel.fetchConfig(agentId, request);
    return answer.ok
      ? { kind: 'fetched', config: answer.reading }
      : {
          kind: 'refused',
          reason: answer.reason,
          error: answer.error
        };
  }
}
