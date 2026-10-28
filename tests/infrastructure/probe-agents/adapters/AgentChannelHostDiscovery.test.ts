import { AgentChannelHostDiscovery } from '../../../../src/infrastructure/probe-agents/adapters/AgentChannelHostDiscovery';
import type { IAgentProbeChannel } from '../../../../src/application/probe-agents/interfaces';

describe('AgentChannelHostDiscovery', () => {
  const channel = {
    ping: jest.fn(),
    readRadio: jest.fn(),
    fetchConfig: jest.fn(),
    readTraffic: jest.fn(),
    sweep: jest.fn(),
    setHostname: jest.fn(),
    discover: jest.fn(),
    readPorts: jest.fn(),
    printRouterOs: jest.fn()
  } satisfies jest.Mocked<IAgentProbeChannel>;
  const discovery = new AgentChannelHostDiscovery(channel);

  it('[DEV-214] passes the hosts the agent found on', async () => {
    const hosts = [
      {
        ipAddress: '10.0.0.5',
        macAddress: 'AA:BB:CC:DD:EE:01',
        latencyMs: 3
      }
    ];
    channel.discover.mockResolvedValue({
      ok: true,
      reading: hosts,
      measuredAt: new Date()
    });

    const result = await discovery.discover('a-1', '10.0.0.0/24');

    expect(result.value).toEqual(hosts);
    expect(channel.discover).toHaveBeenCalledWith(
      'a-1',
      '10.0.0.0/24'
    );
  });

  it('[DEV-214] fails with why the agent could not be asked', async () => {
    channel.discover.mockResolvedValue({
      ok: false,
      reason: 'PROBE_UNSUPPORTED',
      error: 'The agent must be updated to scan the network'
    });

    const result = await discovery.discover('a-1', '10.0.0.0/24');

    expect(result.error).toBe(
      'The agent must be updated to scan the network'
    );
  });
});
