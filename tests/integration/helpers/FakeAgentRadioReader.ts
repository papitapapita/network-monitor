import {
  AgentRadioAnswer,
  AgentRadioReadRequest,
  IAgentRadioReader
} from 'application/wireless-monitoring/interfaces/IAgentRadioReader';

// Stands in for a radio's on-site agent: set the answer, then read back what
// it was asked.
export class FakeAgentRadioReader implements IAgentRadioReader {
  answer: AgentRadioAnswer = {
    kind: 'refused',
    reason: 'AGENT_OFFLINE',
    error: 'The agent is not connected'
  };
  readonly calls: Array<{
    agentId: string;
    request: AgentRadioReadRequest;
  }> = [];

  async read(
    agentId: string,
    request: AgentRadioReadRequest
  ): Promise<AgentRadioAnswer> {
    this.calls.push({ agentId, request });
    return this.answer;
  }
}
