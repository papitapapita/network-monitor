import { AgentChannelTrafficReader } from '../../../../src/infrastructure/probe-agents/adapters/AgentChannelTrafficReader';
import type { IAgentProbeChannel } from '../../../../src/application/probe-agents/interfaces';
import type { RouterConnectionTarget } from '../../../../src/application/device-monitoring/interfaces';

describe('AgentChannelTrafficReader', () => {
  const channel = {
    ping: jest.fn(),
    readRadio: jest.fn(),
    fetchConfig: jest.fn(),
    readTraffic: jest.fn(),
    sweep: jest.fn(),
    setHostname: jest.fn(),
    discover: jest.fn()
  } satisfies jest.Mocked<IAgentProbeChannel>;
  const reader = new AgentChannelTrafficReader(channel);
  const router: RouterConnectionTarget = {
    host: '10.0.0.1',
    port: 8728,
    username: 'api',
    password: 'secreto',
    agentId: 'a-1'
  };
  const ether1 = {
    name: 'ether1',
    type: 'ether',
    running: true,
    rxBps: 1_000,
    txBps: 2_000
  };

  afterEach(() => jest.clearAllMocks());

  it('[MON-065] reads the router through the agent it sits behind', async () => {
    channel.readTraffic.mockResolvedValue({
      ok: true,
      reading: [ether1],
      measuredAt: new Date()
    });

    const result = await reader.read(router);

    expect(result.value).toEqual([ether1]);
    expect(channel.readTraffic).toHaveBeenCalledWith('a-1', router);
  });

  it('[MON-065] passes on why the agent could not read it', async () => {
    channel.readTraffic.mockResolvedValue({
      ok: false,
      reason: 'PROBE_UNSUPPORTED',
      error: 'The agent must be updated to read router traffic'
    });

    const result = await reader.read(router);

    expect(result.error).toBe(
      'The agent must be updated to read router traffic'
    );
  });

  it('[MON-065] refuses a router behind no agent without asking anyone', async () => {
    const result = await reader.read({ ...router, agentId: null });

    expect(result.error).toBe('The router is not behind an agent');
    expect(channel.readTraffic).not.toHaveBeenCalled();
  });
});
