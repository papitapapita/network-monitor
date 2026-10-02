import {
  AgentPingAnswer,
  IAgentPingProbe
} from 'application/device-monitoring/interfaces/IAgentPingProbe';

// Stands in for a device's on-site agent: set the answer, then read back
// what it was asked.
export class FakeAgentPingProbe implements IAgentPingProbe {
  answer: AgentPingAnswer = {
    kind: 'refused',
    reason: 'AGENT_OFFLINE',
    error: 'The agent is not connected'
  };
  readonly calls: Array<{
    agentId: string;
    ipAddress: string;
    attempts: number;
  }> = [];

  async ping(
    agentId: string,
    ipAddress: string,
    attempts: number
  ): Promise<AgentPingAnswer> {
    this.calls.push({ agentId, ipAddress, attempts });
    return this.answer;
  }
}
