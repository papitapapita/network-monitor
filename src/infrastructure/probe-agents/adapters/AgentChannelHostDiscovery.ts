import { Result } from 'domain/shared/core';
import type { IAgentProbeChannel } from 'application/probe-agents/interfaces';
import type {
  AgentScannedHost,
  IAgentHostDiscovery
} from 'application/device-inventory/interfaces';

// Lets the network scan sweep through an agent without knowing how agents
// are reached.
export class AgentChannelHostDiscovery
  implements IAgentHostDiscovery
{
  constructor(private readonly channel: IAgentProbeChannel) {}

  async discover(
    agentId: string,
    cidr: string
  ): Promise<Result<AgentScannedHost[]>> {
    const answer = await this.channel.discover(agentId, cidr);
    return answer.ok
      ? Result.ok(answer.reading)
      : Result.fail(answer.error);
  }
}
