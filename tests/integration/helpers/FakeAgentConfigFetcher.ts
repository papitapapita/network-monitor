import { BackupFormat } from 'domain/device-backups';
import {
  AgentConfigAnswer,
  AgentConfigFetchRequest,
  IAgentConfigFetcher
} from 'application/device-backups/interfaces';
import { FAKE_AIROS_CONFIG } from './FakeConfigFetcher';

/**
 * Stand-in for the agents a device sits behind: records who was asked for
 * which device and answers `answer`, an AirOS file by default.
 */
export class FakeAgentConfigFetcher implements IAgentConfigFetcher {
  readonly calls: { agentId: string; ipAddress: string }[] = [];
  answer: AgentConfigAnswer = {
    kind: 'fetched',
    config: {
      format: BackupFormat.AIROS_CFG,
      content: FAKE_AIROS_CONFIG
    }
  };

  async fetch(
    agentId: string,
    request: AgentConfigFetchRequest
  ): Promise<AgentConfigAnswer> {
    this.calls.push({ agentId, ipAddress: request.ipAddress });
    return this.answer;
  }
}
