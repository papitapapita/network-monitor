// Source: src/infrastructure/power-control/readers/RouterOsPoeReader.ts

import {
  RouterOsPoeReader,
  RouterOsSession
} from '../../../../src/infrastructure/power-control/readers';
import { PoeSwitchConnection } from '../../../../src/application/power-control/interfaces';

type Row = Record<string, string | undefined>;

const CONNECTION: PoeSwitchConnection = {
  host: '10.0.5.2',
  firmware: 'ROUTEROS',
  login: {
    username: 'admin',
    password: 'secret',
    apiPort: 8728,
    httpPort: 443
  }
};

// Answers each command from a table; a command missing from it fails the way
// RouterOS does for a menu that does not exist.
function makeSession(answers: Record<string, Row[]>) {
  const calls: { command: string; params: string[] }[] = [];
  const session: RouterOsSession & { closed: boolean } = {
    closed: false,
    async write(command, params = []) {
      calls.push({ command, params });
      const rows = answers[command];
      if (!rows) throw new Error('no such command prefix');
      return rows;
    },
    async close() {
      session.closed = true;
    }
  };
  return { session, calls };
}

const V7: Record<string, Row[]> = {
  '/system/resource/print': [{ version: '7.15.3 (stable)' }],
  '/interface/ethernet/print': [
    { name: 'ether1' },
    { name: 'ether2', comment: '10.0.5.21' },
    { name: 'ether3', comment: 'Rocket sur' },
    { name: 'sfp1' }
  ],
  '/interface/ethernet/poe/print': [
    { name: 'ether2', 'poe-out': 'auto-on' },
    { name: 'ether3', 'poe-out': 'off' }
  ],
  '/interface/ethernet/poe/monitor': [
    {
      name: 'ether2',
      'poe-out-status': 'powered-on',
      'poe-out-voltage': '24.1',
      'poe-out-current': '254',
      'poe-out-power': '6.1'
    },
    { name: 'ether3', 'poe-out-status': 'disabled' }
  ]
};

describe('RouterOsPoeReader', () => {
  const read = (answers: Record<string, Row[]>) => {
    const { session, calls } = makeSession(answers);
    const reader = new RouterOsPoeReader(
      undefined,
      async () => session
    );
    return reader
      .read(CONNECTION)
      .then((result) => ({ result, session, calls }));
  };

  it('[PWR-023] should read v7 PoE ports from the poe menu', async () => {
    const { result, session } = await read(V7);

    expect(result.value).toEqual({
      firmwareVersion: '7.15.3 (stable)',
      ports: [
        {
          port: 'ether2',
          label: '10.0.5.21',
          mode: 'AUTO',
          status: 'POWERED',
          powerWatts: 6.1,
          voltage: 24.1
        },
        {
          port: 'ether3',
          label: 'Rocket sur',
          mode: 'OFF',
          status: 'OFF',
          powerWatts: null,
          voltage: null
        }
      ]
    });
    expect(session.closed).toBe(true);
  });

  it('[PWR-023] should ask the monitor for every PoE port at once', async () => {
    const { calls } = await read(V7);

    expect(
      calls.find(
        (c) => c.command === '/interface/ethernet/poe/monitor'
      )?.params
    ).toEqual(['=numbers=ether2,ether3', '=once=']);
  });

  it('[PWR-023] should read v6 PoE settings from the ethernet menu', async () => {
    const { result } = await read({
      '/system/resource/print': [{ version: '6.49.10 (long-term)' }],
      '/interface/ethernet/print': [
        { name: 'ether1' },
        {
          name: 'ether2',
          comment: 'BACKHAUL 10.0.5.20',
          'poe-out': 'forced-on'
        },
        { name: 'ether3', 'poe-out': 'auto-on' }
      ],
      '/interface/ethernet/monitor': [
        {
          name: 'ether2',
          'poe-out-status': 'powered-on',
          'poe-out-voltage': '23.9V',
          'poe-out-current': '300mA'
        },
        { name: 'ether3', 'poe-out-status': 'waiting-for-load' }
      ]
    });

    expect(result.value).toEqual({
      firmwareVersion: '6.49.10 (long-term)',
      ports: [
        {
          port: 'ether2',
          label: 'BACKHAUL 10.0.5.20',
          mode: 'FORCED_ON',
          status: 'POWERED',
          powerWatts: 7.17,
          voltage: 23.9
        },
        {
          port: 'ether3',
          label: 'ether3',
          mode: 'AUTO',
          status: 'NO_LOAD',
          powerWatts: null,
          voltage: null
        }
      ]
    });
  });

  it('[PWR-030] should take the label from the name when the IP is there', async () => {
    const { result } = await read({
      ...V7,
      '/interface/ethernet/print': [
        { name: 'ether2-10.0.5.21', comment: 'rocket' }
      ],
      '/interface/ethernet/poe/print': [
        { name: 'ether2-10.0.5.21', 'poe-out': 'auto-on' }
      ]
    });

    expect(result.value.ports[0]!.label).toBe('ether2-10.0.5.21');
  });

  it('[PWR-020] should map each RouterOS mode and keep unknown ones unknown', async () => {
    const { result } = await read({
      ...V7,
      '/interface/ethernet/poe/print': [
        { name: 'ether2', 'poe-out': 'forced-on' },
        { name: 'ether3', 'poe-out': 'auto-on' },
        { name: 'ether4', 'poe-out': 'off' },
        { name: 'ether5', 'poe-out': 'something-new' }
      ]
    });

    expect(result.value.ports.map((p) => p.mode)).toEqual([
      'FORCED_ON',
      'AUTO',
      'OFF',
      'UNKNOWN'
    ]);
  });

  it('[PWR-021] should map fault statuses and keep unknown ones unknown', async () => {
    const { result } = await read({
      ...V7,
      '/interface/ethernet/poe/monitor': [
        { name: 'ether2', 'poe-out-status': 'short-circuit' },
        { name: 'ether3', 'poe-out-status': 'something-new' }
      ]
    });

    expect(result.value.ports.map((p) => p.status)).toEqual([
      'FAULT',
      'UNKNOWN'
    ]);
  });

  it('[PWR-022] should still list the ports when no monitor answers', async () => {
    const { '/interface/ethernet/poe/monitor': _, ...noMonitor } = V7;

    const { result } = await read(noMonitor);

    expect(result.value.ports.map((p) => [p.port, p.status])).toEqual(
      [
        ['ether2', 'UNKNOWN'],
        ['ether3', 'OFF']
      ]
    );
  });

  it('[PWR-022] should list no ports on a router without PoE-out', async () => {
    const { result, calls } = await read({
      '/system/resource/print': [{ version: '7.15.3' }],
      '/interface/ethernet/print': [{ name: 'ether1' }]
    });

    expect(result.value).toEqual({
      firmwareVersion: '7.15.3',
      ports: []
    });
    expect(calls.map((c) => c.command)).not.toContain(
      '/interface/ethernet/poe/monitor'
    );
  });

  it('should fail with the error when the router cannot be reached', async () => {
    const reader = new RouterOsPoeReader(undefined, async () => {
      throw new Error('Timed out after 10 seconds');
    });

    const result = await reader.read(CONNECTION);

    expect(result.error).toBe(
      'RouterOS API error: Timed out after 10 seconds'
    );
  });

  it('should give up and close the login when the router stops answering', async () => {
    const { session } = makeSession({});
    session.write = () => new Promise(() => undefined);
    const reader = new RouterOsPoeReader(
      undefined,
      async () => session,
      20
    );

    const result = await reader.read(CONNECTION);

    expect(result.error).toBe(
      'RouterOS API error: no answer within 20 ms'
    );
    expect(session.closed).toBe(true);
  });
});
