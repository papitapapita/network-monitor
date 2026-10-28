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
  login: { username: 'admin', password: 'secret', apiPort: 8728 },
  agentId: null
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

const NO_COUNTERS = { rxErrors: null, linkDowns: null, sfp: null };

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
          fullDuplex: true,
          ...NO_COUNTERS
        },
        {
          name: 'ether2',
          comment: null,
          linked: true,
          rateMbps: 100,
          fullDuplex: false,
          ...NO_COUNTERS
        },
        {
          name: 'ether3',
          comment: null,
          linked: false,
          rateMbps: null,
          fullDuplex: null,
          ...NO_COUNTERS
        },
        {
          name: 'sfp-sfpplus1',
          comment: null,
          linked: true,
          rateMbps: 10000,
          fullDuplex: true,
          ...NO_COUNTERS
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
        fullDuplex: true,
        ...NO_COUNTERS
      },
      {
        name: 'ether2',
        comment: null,
        linked: false,
        rateMbps: null,
        fullDuplex: null,
        ...NO_COUNTERS
      }
    ]);
  });

  it('[MON-190] should read error counters, link-downs and the fibre module of each port', async () => {
    const { result, calls } = await read({
      ...ROUTER,
      '/interface/ethernet/print': (params) =>
        params.includes('=stats=')
          ? [
              {
                name: 'ether1',
                'rx-fcs-error': '12',
                'rx-align-error': '3'
              },
              { name: 'ether2', 'rx-fcs-error': '7' },
              {
                name: 'sfp-sfpplus1',
                'rx-fcs-error': '0',
                'rx-align-error': '0'
              }
            ]
          : [
              { name: 'ether1' },
              { name: 'ether2' },
              { name: 'ether3' },
              { name: 'sfp-sfpplus1' }
            ],
      '/interface/print': [
        { name: 'ether1', 'link-downs': '4' },
        { name: 'ether2', 'link-downs': '0' },
        { name: 'bridge1', 'link-downs': '9' },
        { name: 'sfp-sfpplus1', 'link-downs': '2' }
      ],
      '/interface/ethernet/monitor': [
        { name: 'ether1', status: 'link-ok', rate: '1Gbps' },
        { name: 'ether2', status: 'link-ok', rate: '100Mbps' },
        {
          name: 'ether3',
          status: 'no-link',
          'sfp-module-present': 'false'
        },
        {
          name: 'sfp-sfpplus1',
          status: 'link-ok',
          rate: '10Gbps',
          'sfp-module-present': 'true',
          'sfp-rx-power': '-7.215dBm',
          'sfp-tx-power': '-2.1',
          'sfp-temperature': '41C'
        }
      ]
    });

    expect(
      result.value.ports.map(
        ({ name, rxErrors, linkDowns, sfp }) => ({
          name,
          rxErrors,
          linkDowns,
          sfp
        })
      )
    ).toEqual([
      { name: 'ether1', rxErrors: 15, linkDowns: 4, sfp: null },
      { name: 'ether2', rxErrors: 7, linkDowns: 0, sfp: null },
      { name: 'ether3', rxErrors: null, linkDowns: null, sfp: null },
      {
        name: 'sfp-sfpplus1',
        rxErrors: 0,
        linkDowns: 2,
        sfp: {
          rxPowerDbm: -7.215,
          txPowerDbm: -2.1,
          temperatureC: 41
        }
      }
    ]);
    expect(calls.map((c) => [c.command, c.params])).toContainEqual([
      '/interface/print',
      ['=.proplist=name,link-downs']
    ]);
  });

  it('[MON-190] should drop a stray bit above the 32-bit error counter', async () => {
    const { result } = await read({
      ...ROUTER,
      '/interface/ethernet/print': (params) =>
        params.includes('=stats=')
          ? [{ name: 'ether3', 'rx-fcs-error': '4294967298' }]
          : [{ name: 'ether3' }]
    });

    expect(result.value.ports[0]!.rxErrors).toBe(2);
  });

  it('[MON-190] should show a module with no readings yet as a fibre port without figures', async () => {
    const { result } = await read({
      ...ROUTER,
      '/interface/ethernet/print': [{ name: 'sfp1' }],
      '/interface/ethernet/monitor': [
        {
          name: 'sfp1',
          status: 'no-link',
          'sfp-module-present': 'true'
        }
      ]
    });

    expect(result.value.ports[0]!.sfp).toEqual({
      rxPowerDbm: null,
      txPowerDbm: null,
      temperatureC: null
    });
  });

  it('[MON-190] should still read the speeds when the counters are refused', async () => {
    const { result } = await read({
      ...ROUTER,
      '/interface/ethernet/print': (params) => {
        if (params.includes('=stats='))
          throw new Error('bad argument');
        return [{ name: 'ether1' }];
      },
      '/interface/print': () => {
        throw new Error('not allowed');
      }
    });

    expect(result.value.ports[0]).toMatchObject({
      name: 'ether1',
      rateMbps: 1000,
      rxErrors: null,
      linkDowns: null
    });
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

  it('[MON-141] should read full duplex written as yes or no', async () => {
    const { result } = await read({
      ...ROUTER,
      '/interface/ethernet/print': [
        { name: 'ether1' },
        { name: 'ether2' }
      ],
      '/interface/ethernet/monitor': [
        {
          name: 'ether1',
          status: 'link-ok',
          rate: '1Gbps',
          'full-duplex': 'yes'
        },
        {
          name: 'ether2',
          status: 'link-ok',
          rate: '100Mbps',
          'full-duplex': 'no'
        }
      ]
    });

    expect(result.value.ports.map((p) => p.fullDuplex)).toEqual([
      true,
      false
    ]);
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
