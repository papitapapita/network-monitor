import type { IAgentProbeChannel } from 'application/probe-agents/interfaces';
import type {
  IAgentRadioSettings,
  RadioSettingsAnswer,
  RadioTarget
} from 'application/wireless-monitoring/interfaces';
import { BackupFormat } from 'domain/device-backups/enums';

// Lets wireless-monitoring read and rename a radio through an agent without
// knowing how agents are reached. The configuration is read with the
// agent's backup request (AGT-114), which every agent that backs up answers.
export class AgentChannelRadioSettings
  implements IAgentRadioSettings
{
  constructor(private readonly channel: IAgentProbeChannel) {}

  async fetchConfig(
    agentId: string,
    target: RadioTarget
  ): Promise<RadioSettingsAnswer<string>> {
    const answer = await this.channel.fetchConfig(agentId, {
      ipAddress: target.ipAddress,
      vendorSlug: target.vendor,
      kind: target.deviceType,
      credentials: target.login
    });
    if (!answer.ok)
      return {
        ok: false,
        reason: answer.reason,
        error: answer.error
      };
    if (answer.reading.format !== BackupFormat.AIROS_CFG)
      return {
        ok: false,
        reason: 'AGENT_ERROR',
        error: 'The agent did not send an AirOS configuration'
      };
    return { ok: true, value: answer.reading.content };
  }

  async setHostname(
    agentId: string,
    target: RadioTarget,
    hostname: string
  ): Promise<RadioSettingsAnswer<void>> {
    const answer = await this.channel.setHostname(agentId, {
      ipAddress: target.ipAddress,
      vendor: target.vendor,
      hostname,
      login: target.login
    });
    return answer.ok
      ? { ok: true, value: undefined }
      : { ok: false, reason: answer.reason, error: answer.error };
  }
}
