import { parseAgentMessage } from '../../../../src/presentation/ws/agent/agentMessageSchema';

const ok = (message: unknown) =>
  parseAgentMessage(JSON.stringify(message));

describe('parseAgentMessage', () => {
  it('accepts a hello', () => {
    expect(
      ok({
        type: 'hello',
        protocolVersion: 1,
        agentVersion: '1.0.0',
        sentAt: 1
      })
    ).toMatchObject({ type: 'hello' });
  });

  it('accepts both result shapes in one batch', () => {
    const message = ok({
      type: 'results',
      batchId: 'b1',
      results: [
        {
          id: 'r1',
          d: 0,
          at: 1,
          reachable: true,
          latencyMs: 4.2,
          attempts: 1
        },
        { id: 'r2', d: 1, at: 1, probeError: 'EPERM', attempts: 3 }
      ]
    });

    expect(message).not.toBeNull();
  });

  it.each([
    ['invalid JSON', '{nope'],
    ['an unknown type', JSON.stringify({ type: 'hack' })],
    [
      'a negative device index',
      JSON.stringify({
        type: 'results',
        batchId: 'b',
        results: [
          {
            id: 'r',
            d: -1,
            at: 1,
            reachable: true,
            latencyMs: 1,
            attempts: 1
          }
        ]
      })
    ],
    [
      'a hello without a protocol version',
      JSON.stringify({ type: 'hello', agentVersion: '1', sentAt: 1 })
    ]
  ])('rejects %s', (_label, raw) => {
    expect(parseAgentMessage(raw)).toBeNull();
  });
});
