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
    expect(hello(['backup', 'probe', 'enforce'])).toMatchObject({
      capabilities: ['probe', 'enforce', 'backup']
    });
    expect(hello(['sweep', 'probe'])).toMatchObject({
      capabilities: ['probe', 'sweep']
    });
    expect(hello(['hostname', 'probe'])).toMatchObject({
      capabilities: ['probe', 'hostname']
    });
    expect(hello(['discover', 'probe'])).toMatchObject({
      capabilities: ['probe', 'discover']
    });
    expect(hello(['ports', 'probe'])).toMatchObject({
      capabilities: ['probe', 'ports']
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

  it('[AGT-114] accepts a backup answer of either format', () => {
    for (const format of ['AIROS_CFG', 'ROUTEROS_EXPORT']) {
      const answer = {
        type: 'probe.result',
        requestId: 'b-1',
        kind: 'backup',
        at: 1,
        config: { format, content: '/ip address\n' }
      };
      expect(ok(answer)).toEqual(answer);
    }
  });

  it.each([
    ['an unknown format', { format: 'JUNOS', content: 'x' }],
    ['no content', { format: 'AIROS_CFG' }],
    [
      'a file over 1,000,000 characters',
      { format: 'AIROS_CFG', content: 'x'.repeat(1_000_001) }
    ]
  ])(
    '[AGT-114] rejects a backup answer with %s',
    (_label, config) => {
      expect(
        ok({
          type: 'probe.result',
          requestId: 'b-1',
          kind: 'backup',
          at: 1,
          config
        })
      ).toBeNull();
    }
  );

  it('[AGT-119] accepts a sweep answer with a reading per address', () => {
    const answer = {
      type: 'probe.result',
      requestId: 's-1',
      kind: 'sweep',
      at: 1,
      readings: [
        { reachable: true, latencyMs: 3, attempts: 1 },
        { reachable: false, latencyMs: null, attempts: 3 },
        { probeError: 'spawn ping EAGAIN', attempts: 1 }
      ]
    };

    expect(ok(answer)).toEqual(answer);
  });

  it('[AGT-119] rejects a sweep answer with more readings than a batch holds', () => {
    expect(
      ok({
        type: 'probe.result',
        requestId: 's-1',
        kind: 'sweep',
        at: 1,
        readings: Array.from({ length: 33 }, () => ({
          reachable: true,
          latencyMs: 1,
          attempts: 1
        }))
      })
    ).toBeNull();
  });

  it('[AGT-120] accepts a hostname answer', () => {
    const answer = {
      type: 'probe.result',
      requestId: 'h-1',
      kind: 'hostname',
      at: 1
    };

    expect(ok(answer)).toEqual(answer);
  });

  it('[AGT-121] accepts a discover answer, with or without a MAC', () => {
    const answer = {
      type: 'probe.result',
      requestId: 'd-1',
      kind: 'discover',
      at: 1,
      hosts: [
        { ip: '10.0.0.1', mac: 'DC:2C:6E:11:22:33', latencyMs: 2 },
        { ip: '10.0.0.9', mac: null, latencyMs: null }
      ]
    };

    expect(ok(answer)).toEqual(answer);
  });

  it('[AGT-121] rejects a discover answer with more hosts than a /22 holds', () => {
    expect(
      ok({
        type: 'probe.result',
        requestId: 'd-1',
        kind: 'discover',
        at: 1,
        hosts: Array.from({ length: 1023 }, (_, i) => ({
          ip: `10.0.${i >> 8}.${i & 255}`,
          mac: null,
          latencyMs: 1
        }))
      })
    ).toBeNull();
  });

  it('[AGT-122] accepts a ports answer, with rates and duplex unknown or known', () => {
    const answer = {
      type: 'probe.result',
      requestId: 'p-1',
      kind: 'ports',
      at: 1,
      identity: 'Core-Norte',
      ports: [
        {
          name: 'ether1',
          comment: 'Uplink',
          linked: true,
          rateMbps: 1000,
          fullDuplex: true
        },
        {
          name: 'sfp-sfpplus1',
          comment: null,
          linked: false,
          rateMbps: null,
          fullDuplex: null
        }
      ]
    };

    expect(ok(answer)).toEqual(answer);
    expect(ok({ ...answer, identity: null })).toMatchObject({
      identity: null
    });
  });

  it('[MON-190] accepts a ports answer with counters and a fibre module', () => {
    const answer = {
      type: 'probe.result',
      requestId: 'p-1',
      kind: 'ports',
      at: 1,
      identity: null,
      ports: [
        {
          name: 'sfp1',
          comment: null,
          linked: true,
          rateMbps: 1000,
          fullDuplex: true,
          rxErrors: 12,
          linkDowns: 3,
          sfp: {
            rxPowerDbm: -7.2,
            txPowerDbm: null,
            temperatureC: 41
          }
        }
      ]
    };

    expect(ok(answer)).toEqual(answer);
    expect(
      ok({
        ...answer,
        ports: [{ ...answer.ports[0], rxErrors: -1 }]
      })
    ).toBeNull();
  });

  it('[AGT-122] rejects a ports answer with more ports than the protocol allows', () => {
    expect(
      ok({
        type: 'probe.result',
        requestId: 'p-1',
        kind: 'ports',
        at: 1,
        identity: null,
        ports: Array.from({ length: 129 }, (_, i) => ({
          name: `ether${i}`,
          comment: null,
          linked: false,
          rateMbps: null,
          fullDuplex: null
        }))
      })
    ).toBeNull();
  });

  it('[AGT-123] accepts a RouterOS print answer with rows and errors', () => {
    const answer = {
      type: 'probe.result',
      requestId: 'r-1',
      kind: 'routeros-print',
      at: 1,
      answers: [
        { rows: [{ name: 'Core', 'board-name': 'RB4011iGS+' }] },
        { error: 'no such command' },
        { rows: [] }
      ]
    };

    expect(ok(answer)).toEqual(answer);
  });

  it('[AGT-123] rejects a RouterOS print answer over the limits', () => {
    const base = {
      type: 'probe.result',
      requestId: 'r-1',
      kind: 'routeros-print',
      at: 1
    };
    expect(
      ok({
        ...base,
        answers: [
          { rows: Array.from({ length: 5001 }, () => ({ a: '1' })) }
        ]
      })
    ).toBeNull();
    expect(
      ok({
        ...base,
        answers: Array.from({ length: 9 }, () => ({ rows: [] }))
      })
    ).toBeNull();
    expect(
      ok({ ...base, answers: [{ rows: [{ a: 'x'.repeat(1025) }] }] })
    ).toBeNull();
    expect(
      ok({ ...base, answers: [{ rows: [{ a: 1 }] }] })
    ).toBeNull();
    expect(
      ok({ ...base, answers: [{ rows: [], error: 'both' }] })
    ).toBeNull();
  });

  it('[AGT-111] accepts every shape of enforce answer', () => {
    const answers = [
      {
        type: 'enforce.result',
        requestId: 'e-1',
        queues: [{ name: 'suspend-a', targetIp: '10.0.0.5' }]
      },
      { type: 'enforce.result', requestId: 'e-2', queues: null },
      {
        type: 'enforce.result',
        requestId: 'e-3',
        error: 'Login failed'
      }
    ];

    for (const answer of answers) {
      expect(ok(answer)).toEqual(answer);
    }
  });

  it('[AGT-111] rejects an enforce answer with neither queues nor error', () => {
    expect(
      ok({ type: 'enforce.result', requestId: 'e-4' })
    ).toBeNull();
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
