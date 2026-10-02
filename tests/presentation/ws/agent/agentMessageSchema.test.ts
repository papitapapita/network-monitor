import { parseAgentMessage } from '../../../../src/presentation/ws/agent/agentMessageSchema';
import { toWirelessReadingWire } from '../../../../src/agent/probes/ProbeRunner';
import { makeWirelessCollectionResult } from '../../../fixtures/wirelessCollection';

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

  it('[AGT-082] keeps a known platform from the hello and drops an unknown one', () => {
    const hello = (platform: string) =>
      ok({
        type: 'hello',
        protocolVersion: 1,
        agentVersion: '1.0.0',
        platform,
        sentAt: 1
      });

    expect(hello('win-x64')).toMatchObject({ platform: 'win-x64' });
    const unknown = hello('mac-arm64');
    expect(unknown).not.toBeNull();
    expect(
      (unknown as { platform?: string }).platform
    ).toBeUndefined();
  });

  it('[AGT-100] keeps the capabilities it knows from the hello and drops the rest', () => {
    const hello = (capabilities?: unknown) =>
      ok({
        type: 'hello',
        protocolVersion: 1,
        agentVersion: '0.3.0',
        ...(capabilities === undefined ? {} : { capabilities }),
        sentAt: 1
      });

    expect(hello(['probe', 'teleport'])).toMatchObject({
      capabilities: ['probe']
    });
    expect(hello()).toMatchObject({ capabilities: [] });
    expect(hello('probe')).toBeNull();
  });

  it('[AGT-103] accepts a ping answer, a radio reading and an error', () => {
    const answers = [
      {
        type: 'probe.result',
        requestId: 'r-1',
        kind: 'ping',
        at: 1,
        reading: { reachable: true, latencyMs: 3, attempts: 1 }
      },
      {
        type: 'probe.result',
        requestId: 'r-2',
        kind: 'ping',
        at: 1,
        reading: { probeError: 'spawn ping ENOENT', attempts: 3 }
      },
      {
        type: 'probe.result',
        requestId: 'r-3',
        kind: 'wireless',
        at: 1,
        reading: toWirelessReadingWire(makeWirelessCollectionResult())
      },
      {
        type: 'probe.result',
        requestId: 'r-4',
        error: 'Login failed'
      }
    ];

    for (const answer of answers) {
      expect(ok(answer)).toEqual(answer);
    }
  });

  it.each([
    [
      'a byte counter that is not a whole number',
      { wirelessTxBytes: '1e9' }
    ],
    ['a byte counter sent as a number', { wirelessRxBytes: 5 }],
    ['an unknown radio mode', { mode: 'mesh' }],
    ['a missing field', { deviceName: undefined }]
  ])(
    '[AGT-103] rejects a radio reading with %s',
    (_label, change) => {
      expect(
        ok({
          type: 'probe.result',
          requestId: 'r-1',
          kind: 'wireless',
          at: 1,
          reading: {
            ...toWirelessReadingWire(makeWirelessCollectionResult()),
            ...change
          }
        })
      ).toBeNull();
    }
  );

  it('[AGT-103] rejects an answer without a request id', () => {
    expect(ok({ type: 'probe.result', error: 'x' })).toBeNull();
  });

  it('[AGT-084] accepts an update result, with a reason or without', () => {
    expect(
      ok({
        type: 'update.result',
        version: '0.2.1',
        outcome: 'rolled-back',
        reason: 'timeout'
      })
    ).toMatchObject({ outcome: 'rolled-back', reason: 'timeout' });
    expect(
      ok({
        type: 'update.result',
        version: '0.2.1',
        outcome: 'installed'
      })
    ).not.toBeNull();
    expect(
      ok({
        type: 'update.result',
        version: '0.2.1',
        outcome: 'exploded'
      })
    ).toBeNull();
    expect(
      ok({
        type: 'update.result',
        version: '0.2.1',
        outcome: 'rejected',
        reason: 'x'.repeat(501)
      })
    ).toBeNull();
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
