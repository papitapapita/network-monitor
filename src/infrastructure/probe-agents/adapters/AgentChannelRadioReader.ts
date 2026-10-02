import type { IAgentProbeChannel } from 'application/probe-agents/interfaces';
import type {
  AgentRadioAnswer,
  AgentRadioReadRequest,
  IAgentRadioReader
} from 'application/wireless-monitoring/interfaces';

// Lets wireless-monitoring read a radio through an agent without knowing how
// agents are reached.
export class AgentChannelRadioReader implements IAgentRadioReader {
  constructor(private readonly channel: IAgentProbeChannel) {}

  async read(
    agentId: string,
    request: AgentRadioReadRequest
  ): Promise<AgentRadioAnswer> {
    const answer = await this.channel.readRadio(agentId, request);
    return answer.ok
      ? {
          kind: 'measured',
          reading: answer.reading,
          measuredAt: answer.measuredAt
        }
      : {
          kind: 'refused',
          reason: answer.reason,
          error: answer.error
        };
  }
}
