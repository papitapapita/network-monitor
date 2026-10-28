import { AgentChannelConfigFetcher } from '../../../../src/infrastructure/probe-agents/adapters/AgentChannelConfigFetcher';
import type { IAgentProbeChannel } from '../../../../src/application/probe-agents/interfaces';
import type { AgentConfigFetchRequest } from '../../../../src/application/device-backups/interfaces';
import { BackupFormat } from '../../../../src/domain/device-backups';

describe('AgentChannelConfigFetcher', () => {
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
  const fetcher = new AgentChannelConfigFetcher(channel);
  const request: AgentConfigFetchRequest = {
    ipAddress: '10.0.0.1',
    vendorSlug: 'mikrotik',
    kind: 'ROUTER',
    credentials: {
      username: 'admin',
      password: 'secreto',
      httpPort: 443,
      sshPort: 22
    }
  };

  it('[BKP-016] passes on the file the agent read', async () => {
    const config = {
      format: BackupFormat.ROUTEROS_EXPORT,
      content: '/ip address\n'
    };
    channel.fetchConfig.mockResolvedValue({
      ok: true,
      reading: config,
      measuredAt: new Date()
    });

    await expect(fetcher.fetch('a-1', request)).resolves.toEqual({
      kind: 'fetched',
      config
    });
    expect(channel.fetchConfig).toHaveBeenCalledWith('a-1', request);
  });

  it('[BKP-016] passes on why the agent could not read it', async () => {
    channel.fetchConfig.mockResolvedValue({
      ok: false,
      reason: 'PROBE_UNSUPPORTED',
      error: 'The agent must be updated to take backups'
    });

    await expect(fetcher.fetch('a-1', request)).resolves.toEqual({
      kind: 'refused',
      reason: 'PROBE_UNSUPPORTED',
      error: 'The agent must be updated to take backups'
    });
  });
});
