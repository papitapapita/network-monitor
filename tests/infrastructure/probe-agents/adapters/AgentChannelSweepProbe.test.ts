import { AgentChannelSweepProbe } from '../../../../src/infrastructure/probe-agents/adapters/AgentChannelSweepProbe';
import type { IAgentProbeChannel } from '../../../../src/application/probe-agents/interfaces';

describe('AgentChannelSweepProbe', () => {
  const channel = {
    ping: jest.fn(),
    readRadio: jest.fn(),
    fetchConfig: jest.fn(),
    readTraffic: jest.fn(),
    sweep: jest.fn()
  } satisfies jest.Mocked<IAgentProbeChannel>;
  const probe = new AgentChannelSweepProbe(channel);

  it('[MON-084] passes the agent’s readings on in order', async () => {
    const readings = [
      {
        kind: 'measured',
        isReachable: true,
        latencyMs: 4,
        attempts: 1
      },
      {
        kind: 'measured',
        isReachable: false,
        latencyMs: null,
        attempts: 3
      }
    ];
    channel.sweep.mockResolvedValue({
      ok: true,
      reading: readings,
      measuredAt: new Date()
    });

    await expect(
      probe.sweep('a-1', ['10.0.0.1', '10.0.0.2'], 3)
    ).resolves.toEqual({ kind: 'measured', outcomes: readings });
    expect(channel.sweep).toHaveBeenCalledWith(
      'a-1',
      ['10.0.0.1', '10.0.0.2'],
      3
    );
  });

  it('[MON-084] passes on why the agent could not be asked', async () => {
    channel.sweep.mockResolvedValue({
      ok: false,
      reason: 'PROBE_UNSUPPORTED',
      error: 'The agent must be updated to sweep the network'
    });

    await expect(
      probe.sweep('a-1', ['10.0.0.1'], 3)
    ).resolves.toEqual({
      kind: 'refused',
      reason: 'PROBE_UNSUPPORTED',
      error: 'The agent must be updated to sweep the network'
    });
  });
});
