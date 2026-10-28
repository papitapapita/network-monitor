import { AgentChannelRadioSettings } from '../../../../src/infrastructure/probe-agents/adapters/AgentChannelRadioSettings';
import type { IAgentProbeChannel } from '../../../../src/application/probe-agents/interfaces';
import type { RadioTarget } from '../../../../src/application/wireless-monitoring/interfaces';
import { BackupFormat } from '../../../../src/domain/device-backups';

describe('AgentChannelRadioSettings', () => {
  const channel = {
    ping: jest.fn(),
    readRadio: jest.fn(),
    fetchConfig: jest.fn(),
    readTraffic: jest.fn(),
    sweep: jest.fn(),
    setHostname: jest.fn(),
    discover: jest.fn(),
    readPorts: jest.fn()
  } satisfies jest.Mocked<IAgentProbeChannel>;
  const settings = new AgentChannelRadioSettings(channel);
  const target: RadioTarget = {
    ipAddress: '10.0.0.5',
    vendor: 'ubiquiti',
    deviceType: 'STATION',
    login: {
      username: 'ubnt',
      password: 'secreto',
      httpPort: 443,
      sshPort: 22
    }
  };

  beforeEach(() => jest.clearAllMocks());

  describe('fetchConfig', () => {
    it("[WLS-225] reads the radio's file with the agent's backup request", async () => {
      channel.fetchConfig.mockResolvedValue({
        ok: true,
        reading: {
          format: BackupFormat.AIROS_CFG,
          content: 'radio.1.mode=managed\n'
        },
        measuredAt: new Date()
      });

      await expect(
        settings.fetchConfig('a-1', target)
      ).resolves.toEqual({
        ok: true,
        value: 'radio.1.mode=managed\n'
      });
      expect(channel.fetchConfig).toHaveBeenCalledWith('a-1', {
        ipAddress: '10.0.0.5',
        vendorSlug: 'ubiquiti',
        kind: 'STATION',
        credentials: target.login
      });
    });

    it('[WLS-225] passes on why the agent could not read it', async () => {
      channel.fetchConfig.mockResolvedValue({
        ok: false,
        reason: 'TIMEOUT',
        error: 'The agent did not answer in time'
      });

      await expect(
        settings.fetchConfig('a-1', target)
      ).resolves.toEqual({
        ok: false,
        reason: 'TIMEOUT',
        error: 'The agent did not answer in time'
      });
    });

    it('[WLS-225] refuses a file that is not an AirOS configuration', async () => {
      channel.fetchConfig.mockResolvedValue({
        ok: true,
        reading: {
          format: BackupFormat.ROUTEROS_EXPORT,
          content: '/ip address\n'
        },
        measuredAt: new Date()
      });

      await expect(
        settings.fetchConfig('a-1', target)
      ).resolves.toMatchObject({ ok: false, reason: 'AGENT_ERROR' });
    });
  });

  describe('setHostname', () => {
    it('[AGT-120] asks the agent to rename the radio', async () => {
      channel.setHostname.mockResolvedValue({
        ok: true,
        reading: null,
        measuredAt: new Date()
      });

      await expect(
        settings.setHostname('a-1', target, 'AP Norte')
      ).resolves.toEqual({ ok: true, value: undefined });
      expect(channel.setHostname).toHaveBeenCalledWith('a-1', {
        ipAddress: '10.0.0.5',
        vendor: 'ubiquiti',
        hostname: 'AP Norte',
        login: target.login
      });
    });

    it('[AGT-120] passes on an agent too old to rename', async () => {
      channel.setHostname.mockResolvedValue({
        ok: false,
        reason: 'PROBE_UNSUPPORTED',
        error: 'The agent must be updated to rename radios'
      });

      await expect(
        settings.setHostname('a-1', target, 'AP Norte')
      ).resolves.toEqual({
        ok: false,
        reason: 'PROBE_UNSUPPORTED',
        error: 'The agent must be updated to rename radios'
      });
    });
  });
});
