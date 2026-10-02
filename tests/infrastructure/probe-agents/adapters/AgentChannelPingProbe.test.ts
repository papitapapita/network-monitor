import { AgentChannelPingProbe } from '../../../../src/infrastructure/probe-agents/adapters/AgentChannelPingProbe';
import type { IAgentProbeChannel } from '../../../../src/application/probe-agents/interfaces';

describe('AgentChannelPingProbe', () => {
  const channel = {
    ping: jest.fn(),
    readRadio: jest.fn()
  } satisfies jest.Mocked<IAgentProbeChannel>;
  const probe = new AgentChannelPingProbe(channel);

  it('[MON-022] passes the agent’s reading on with its time', async () => {
    const measuredAt = new Date();
    const reading = {
      kind: 'measured',
      isReachable: false,
      latencyMs: null,
      attempts: 3
    };
    channel.ping.mockResolvedValue({ ok: true, reading, measuredAt });

    await expect(probe.ping('a-1', '10.0.0.9', 3)).resolves.toEqual({
      kind: 'measured',
      outcome: reading,
      measuredAt
    });
    expect(channel.ping).toHaveBeenCalledWith('a-1', '10.0.0.9', 3);
  });

  it('[MON-022] passes on why the agent could not be asked', async () => {
    channel.ping.mockResolvedValue({
      ok: false,
      reason: 'PROBE_UNSUPPORTED',
      error: 'The agent must be updated to answer this request'
    });

    await expect(probe.ping('a-1', '10.0.0.9', 3)).resolves.toEqual({
      kind: 'refused',
      reason: 'PROBE_UNSUPPORTED',
      error: 'The agent must be updated to answer this request'
    });
  });
});
