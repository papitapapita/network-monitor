import { AgentChannelPortReader } from '../../../../src/infrastructure/probe-agents/adapters/AgentChannelPortReader';
import type { IAgentProbeChannel } from '../../../../src/application/probe-agents/interfaces';
import type { RouterPortConnection } from '../../../../src/application/device-monitoring/interfaces';

describe('AgentChannelPortReader', () => {
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
  const reader = new AgentChannelPortReader(channel);
  const router: RouterPortConnection = {
    host: '192.168.77.1',
    login: { username: 'api', password: 'secret', apiPort: 8728 },
    agentId: 'a-1'
  };

  beforeEach(() => channel.readPorts.mockReset());

  it('[MON-145] reads the ports through the agent the router sits behind', async () => {
    const reading = {
      identity: 'Core',
      ports: [
        {
          name: 'ether1',
          comment: null,
          linked: true,
          rateMbps: 1000,
          fullDuplex: true
        }
      ]
    };
    channel.readPorts.mockResolvedValue({
      ok: true,
      reading,
      measuredAt: new Date()
    });

    const result = await reader.read(router);

    expect(result.value).toEqual(reading);
    expect(channel.readPorts).toHaveBeenCalledWith('a-1', router);
  });

  it('[MON-145] fails with why the agent could not read the router', async () => {
    channel.readPorts.mockResolvedValue({
      ok: false,
      reason: 'PROBE_UNSUPPORTED',
      error: 'The agent must be updated to read port speeds'
    });

    const result = await reader.read(router);

    expect(result.error).toBe(
      'The agent must be updated to read port speeds'
    );
  });

  it('[MON-145] fails without asking when the router is behind no agent', async () => {
    const result = await reader.read({ ...router, agentId: null });

    expect(result.error).toBe('The router is not behind an agent');
    expect(channel.readPorts).not.toHaveBeenCalled();
  });
});
