import {
  AgentChannelRouterOsPrinter,
  ROUTER_NOT_BEHIND_AGENT_FOR_PRINT
} from '../../../../src/infrastructure/probe-agents/adapters/AgentChannelRouterOsPrinter';
import type { IAgentProbeChannel } from '../../../../src/application/probe-agents/interfaces';
import type { RouterPortConnection } from '../../../../src/application/device-monitoring/interfaces';

describe('AgentChannelRouterOsPrinter', () => {
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
  const printer = new AgentChannelRouterOsPrinter(channel);
  const router: RouterPortConnection = {
    host: '192.168.77.1',
    login: { username: 'api', password: 'secret', apiPort: 8728 },
    agentId: 'a-1'
  };
  const commands = [
    { command: '/system/identity/print', params: [] }
  ];

  beforeEach(() => channel.printRouterOs.mockReset());

  it('[AGT-123] runs the commands through the agent the router sits behind', async () => {
    const answers = [{ rows: [{ name: 'Core' }] }];
    channel.printRouterOs.mockResolvedValue({
      ok: true,
      reading: answers,
      measuredAt: new Date()
    });

    const result = await printer.print(router, commands);

    expect(result.value).toEqual(answers);
    expect(channel.printRouterOs).toHaveBeenCalledWith(
      'a-1',
      router,
      commands
    );
  });

  it('[AGT-123] passes the agent failure on', async () => {
    channel.printRouterOs.mockResolvedValue({
      ok: false,
      reason: 'PROBE_UNSUPPORTED',
      error: 'The agent must be updated to read this from routers'
    });

    const result = await printer.print(router, commands);

    expect(result.error).toBe(
      'The agent must be updated to read this from routers'
    );
  });

  it('[AGT-123] fails a router that is not behind an agent', async () => {
    const result = await printer.print(
      { ...router, agentId: null },
      commands
    );

    expect(result.error).toBe(ROUTER_NOT_BEHIND_AGENT_FOR_PRINT);
    expect(channel.printRouterOs).not.toHaveBeenCalled();
  });
});
