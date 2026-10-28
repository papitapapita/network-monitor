// Source: src/infrastructure/monitoring/port-speeds/RouterOsPortReader.ts

import {
  parseRate,
  RouterOsPortReader,
  RouterOsSession
} from '../../../../src/infrastructure/monitoring/port-speeds/RouterOsPortReader';
import { RouterPortConnection } from '../../../../src/application/device-monitoring/interfaces';

type Row = Record<string, string | undefined>;
type Answer = Row[] | ((params: string[]) => Row[]);

const CONNECTION: RouterPortConnection = {
  host: '10.0.0.1',
  login: { username: 'admin', password: 'secret', apiPort: 8728 }
};

function makeSession(answers: Record<string, Answer>) {
  const calls: { command: string; params: string[] }[] = [];
  const session: RouterOsSession & { closed: boolean } = {
    closed: false,
    async write(command, params = []) {
      calls.push({ command, params });
      const answer = answers[command];
      if (!answer) throw new Error('no such command prefix');
      return typeof answer === 'function' ? answer(params) : answer;
    },
    async close() {
      session.closed = true;
    }
  };
  return { session, calls };
}

const ROUTER: Record<string, Answer> = {
  '/system/identity/print': [{ name: 'Core-Insetel' }],
  '/interface/ethernet/print': [
    { name: 'ether1', comment: 'Uplink ISP 1' },
    { name: 'ether2', comment: '  ' },
    { name: 'ether3' },
    { name: 'sfp-sfpplus1' }
  ],
  '/interface/ethernet/monitor': [
    {
      name: 'ether1',
      status: 'link-ok',
      rate: '1Gbps',
      'full-duplex': 'true'
    },
    {
      name: 'ether2',
      status: 'link-ok',
      rate: '100Mbps',
      'full-duplex': 'false'
    },
    { name: 'ether3', status: 'no-link' },
    {
      name: 'sfp-sfpplus1',
      status: 'link-ok',
      rate: '10Gbps',
      'full-duplex': 'true'
    }
  ]
};

describe('RouterOsPortReader', () => {
  const read = (answers: Record<string, Answer>) => {
    const { session, calls } = makeSession(answers);
    const reader = new RouterOsPortReader(
      undefined,
      async () => session
    );
    return reader
      .read(CONNECTION)
      .then((result) => ({ result, session, calls }));
  };

  it('[MON-141] should read the identity and every enabled port', async () => {
    const { result, session } = await read(ROUTER);

    expect(result.value).toEqual({
      identity: 'Core-Insetel',
      ports: [
        {
          name: 'ether1',
          comment: 'Uplink ISP 1',
          linked: true,
          rateMbps: 1000,
          fullDuplex: true
        },
        {
          name: 'ether2',
          comment: null,
          linked: true,
          rateMbps: 100,
          fullDuplex: false
        },
        {
          name: 'ether3',
          comment: null,
          linked: false,
          rateMbps: null,
          fullDuplex: null
        },
        {
          name: 'sfp-sfpplus1',
          comment: null,
          linked: true,
          rateMbps: 10000,
          fullDuplex: true
        }
      ]
    });
    expect(session.closed).toBe(true);
  });

  it('[MON-141] should list only enabled ports and monitor them at once', async () => {
    const { calls } = await read(ROUTER);

    expect(
      calls.find((c) => c.command === '/interface/ethernet/print')
        ?.params
    ).toContain('?disabled=false');
    expect(
      calls.filter((c) => c.command === '/interface/ethernet/monitor')
    ).toEqual([
      {
        command: '/interface/ethernet/monitor',
        params: [
          '=numbers=ether1,ether2,ether3,sfp-sfpplus1',
          '=once='
        ]
      }
    ]);
  });

  it('[MON-141] should monitor each port on its own when the router refuses them together', async () => {
    const monitorRow = (name: string): Row => ({
      name,
      status: 'link-ok',
      rate: '1Gbps',
      'full-duplex': 'true'
    });
    const { result } = await read({
      ...ROUTER,
      '/interface/ethernet/print': [
        { name: 'ether1' },
        { name: 'ether2' }
      ],
      '/interface/ethernet/monitor': (params) => {
        const list = params[0]!.replace('=numbers=', '').split(',');
        if (list.length > 1 || list[0] === 'ether2') {
          throw new Error('no such item');
        }
        return [monitorRow(list[0]!)];
      }
    });

    expect(result.value.ports).toEqual([
      {
        name: 'ether1',
        comment: null,
        linked: true,
        rateMbps: 1000,
        fullDuplex: true
      },
      {
        name: 'ether2',
        comment: null,
        linked: false,
        rateMbps: null,
        fullDuplex: null
      }
    ]);
  });

  it('[MON-141] should take the port name from the order asked when the row has none', async () => {
    const { result } = await read({
      ...ROUTER,
      '/interface/ethernet/print': [{ name: 'ether1' }],
      '/interface/ethernet/monitor': [
        { status: 'link-ok', rate: '100Mbps', 'full-duplex': 'true' }
      ]
    });

    expect(result.value.ports[0]).toMatchObject({
      name: 'ether1',
      rateMbps: 100
    });
  });

  it('should not ask the monitor when the router has no enabled ports', async () => {
    const { result, calls } = await read({
      ...ROUTER,
      '/interface/ethernet/print': []
    });

    expect(result.value).toEqual({
      identity: 'Core-Insetel',
      ports: []
    });
    expect(
      calls.some((c) => c.command === '/interface/ethernet/monitor')
    ).toBe(false);
  });

  it('should fail with the API error and still close the login', async () => {
    const { result, session } = await read({
      '/system/identity/print': [{ name: 'Core' }]
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toBe(
      'RouterOS API error: no such command prefix'
    );
    expect(session.closed).toBe(true);
  });

  it('should fail when the login is refused', async () => {
    const reader = new RouterOsPortReader(undefined, async () => {
      throw new Error('cannot log in');
    });

    const result = await reader.read(CONNECTION);

    expect(result.error).toBe('RouterOS API error: cannot log in');
  });

  it('should fail a router that does not answer in time', async () => {
    const reader = new RouterOsPortReader(
      undefined,
      async () => ({
        write: () => new Promise(() => undefined),
        close: async () => undefined
      }),
      20
    );

    const result = await reader.read(CONNECTION);

    expect(result.error).toBe(
      'RouterOS API error: no answer within 20 ms'
    );
  });
});

describe('parseRate', () => {
  it.each([
    ['10Mbps', 10],
    ['100Mbps', 100],
    ['1Gbps', 1000],
    ['2.5Gbps', 2500],
    ['10Gbps', 10000],
    ['100Gbps', 100000]
  ])('[MON-141] should read %s as %i Mbps', (raw, mbps) => {
    expect(parseRate(raw)).toBe(mbps);
  });

  it.each([undefined, '', 'auto', '1Tbps'])(
    '[MON-141] should not read %p',
    (raw) => {
      expect(parseRate(raw)).toBeNull();
    }
  );
});
