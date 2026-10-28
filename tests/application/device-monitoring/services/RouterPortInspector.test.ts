// Source: src/application/device-monitoring/services/RouterPortInspector.ts

import {
  judgePort,
  RouterPortInspector
} from '../../../../src/application/device-monitoring/services/RouterPortInspector';
import {
  EthernetPortReading,
  IRouterPortReader,
  PortSpeedRouterCandidate
} from '../../../../src/application/device-monitoring/interfaces';
import { IPortExpectedSpeedRepository } from '../../../../src/domain/device-monitoring/repository';
import { PortExpectedSpeed } from '../../../../src/domain/device-monitoring/entities';
import { DeviceId } from '../../../../src/domain/shared/ids';
import { Result } from '../../../../src/domain/shared/core/Result';

const CORE_ID = '6f1c2b1e-3c1a-4d8a-9a3e-1b2c3d4e5f60';
const EDGE_ID = '7a2d3c2f-4d2b-4e9b-8b4f-2c3d4e5f6a71';
const LOGIN = {
  username: 'admin',
  password: 'secret',
  apiPort: 8728
};

function makeCandidate(
  overrides: Partial<PortSpeedRouterCandidate> = {}
): PortSpeedRouterCandidate {
  return {
    deviceId: CORE_ID,
    deviceName: 'RB4011 Core',
    ipAddress: '10.0.0.1',
    reach: { by: 'server' },
    login: LOGIN,
    ...overrides
  };
}

function makePort(
  overrides: Partial<EthernetPortReading> = {}
): EthernetPortReading {
  return {
    name: 'ether1',
    comment: null,
    linked: true,
    rateMbps: 1000,
    fullDuplex: true,
    ...overrides
  };
}

function makeExpected(
  portName: string,
  expectedMbps: number,
  deviceId = CORE_ID
): PortExpectedSpeed {
  return PortExpectedSpeed.create({
    deviceId: DeviceId.parse(deviceId).value,
    portName,
    expectedMbps
  }).value;
}

function makeRepository(
  speeds: PortExpectedSpeed[]
): jest.Mocked<IPortExpectedSpeedRepository> {
  return {
    listForDevices: jest.fn().mockResolvedValue(Result.ok(speeds)),
    find: jest.fn(),
    saveAll: jest.fn(),
    saveCheckState: jest.fn(),
    delete: jest.fn()
  };
}

describe('judgePort', () => {
  it('[MON-143] should be NO_LINK without a link, expected or not', () => {
    expect(judgePort(makePort({ linked: false }), null)).toBe(
      'NO_LINK'
    );
    expect(
      judgePort(
        makePort({ linked: false }),
        makeExpected('ether1', 1000)
      )
    ).toBe('NO_LINK');
  });

  it('[MON-143] should be NO_EXPECTATION for a linked port nobody set', () => {
    expect(judgePort(makePort(), null)).toBe('NO_EXPECTATION');
  });

  it('[MON-143] should be OK at the expected speed', () => {
    expect(judgePort(makePort(), makeExpected('ether1', 1000))).toBe(
      'OK'
    );
  });

  it('[MON-143] should be SLOW below the expected speed', () => {
    expect(
      judgePort(
        makePort({ rateMbps: 100 }),
        makeExpected('ether1', 1000)
      )
    ).toBe('SLOW');
  });

  it('[MON-143] should be SLOW at half duplex', () => {
    expect(
      judgePort(
        makePort({ rateMbps: 100, fullDuplex: false }),
        makeExpected('ether1', 100)
      )
    ).toBe('SLOW');
  });

  it('[MON-143] should not call a port half duplex when the router does not say', () => {
    expect(
      judgePort(
        makePort({ fullDuplex: null }),
        makeExpected('ether1', 1000)
      )
    ).toBe('OK');
  });

  it('[MON-143] should be UNKNOWN when a linked port reports no rate', () => {
    expect(
      judgePort(
        makePort({ rateMbps: null }),
        makeExpected('ether1', 1000)
      )
    ).toBe('UNKNOWN');
  });
});

describe('RouterPortInspector', () => {
  const reader: jest.Mocked<IRouterPortReader> = { read: jest.fn() };

  beforeEach(() => reader.read.mockReset());

  it('[MON-140] should list each port with its rate, expectation and verdict', async () => {
    reader.read.mockResolvedValue(
      Result.ok({
        identity: 'Core-Insetel',
        ports: [
          makePort({ name: 'ether1', comment: 'Uplink' }),
          makePort({ name: 'ether2', rateMbps: 100 }),
          makePort({ name: 'ether3', linked: false, rateMbps: null })
        ]
      })
    );
    const inspector = new RouterPortInspector(
      reader,
      makeRepository([
        makeExpected('ether1', 1000),
        makeExpected('ether2', 1000),
        makeExpected('ether1', 100, EDGE_ID)
      ])
    );

    const result = await inspector.inspect([makeCandidate()]);

    expect(result.value).toEqual([
      {
        deviceId: CORE_ID,
        name: 'RB4011 Core',
        identity: 'Core-Insetel',
        ipAddress: '10.0.0.1',
        readable: true,
        reason: null,
        error: null,
        ports: [
          {
            name: 'ether1',
            comment: 'Uplink',
            linked: true,
            rateMbps: 1000,
            fullDuplex: true,
            expectedMbps: 1000,
            verdict: 'OK'
          },
          {
            name: 'ether2',
            comment: null,
            linked: true,
            rateMbps: 100,
            fullDuplex: true,
            expectedMbps: 1000,
            verdict: 'SLOW'
          },
          {
            name: 'ether3',
            comment: null,
            linked: false,
            rateMbps: null,
            fullDuplex: true,
            expectedMbps: null,
            verdict: 'NO_LINK'
          }
        ]
      }
    ]);
    expect(reader.read).toHaveBeenCalledWith({
      host: '10.0.0.1',
      login: LOGIN,
      agentId: null
    });
  });

  it('[MON-143] should show an expectation on a port the router no longer has', async () => {
    reader.read.mockResolvedValue(
      Result.ok({ identity: null, ports: [makePort()] })
    );
    const inspector = new RouterPortInspector(
      reader,
      makeRepository([makeExpected('ether9', 1000)])
    );

    const result = await inspector.inspect([makeCandidate()]);

    expect(result.value[0]!.ports[1]).toEqual({
      name: 'ether9',
      comment: null,
      linked: null,
      rateMbps: null,
      fullDuplex: null,
      expectedMbps: 1000,
      verdict: 'PORT_MISSING'
    });
  });

  it('[MON-140] should report a router that did not answer and still show the others', async () => {
    reader.read.mockImplementation(async (c) =>
      c.host === '10.0.0.1'
        ? Result.fail('RouterOS API error: timeout')
        : Result.ok({ identity: 'Edge', ports: [] })
    );
    const inspector = new RouterPortInspector(
      reader,
      makeRepository([])
    );

    const result = await inspector.inspect([
      makeCandidate(),
      makeCandidate({
        deviceId: EDGE_ID,
        deviceName: 'hEX Edge',
        ipAddress: '10.0.0.2'
      })
    ]);

    expect(result.value.map((r) => [r.readable, r.error])).toEqual([
      [true, 'RouterOS API error: timeout'],
      [true, null]
    ]);
    expect(result.value[1]!.identity).toBe('Edge');
  });

  it('[MON-145] should list a router it cannot read with the reason, without trying it', async () => {
    const inspector = new RouterPortInspector(
      reader,
      makeRepository([])
    );

    const result = await inspector.inspect([
      makeCandidate({ login: null })
    ]);

    expect(result.value[0]).toMatchObject({
      readable: false,
      reason: 'The router has no username and password saved',
      error: null,
      ports: []
    });
    expect(reader.read).not.toHaveBeenCalled();
  });

  it('should fail when the expectations cannot be loaded', async () => {
    reader.read.mockResolvedValue(
      Result.ok({ identity: null, ports: [] })
    );
    const repository = makeRepository([]);
    repository.listForDevices.mockResolvedValue(
      Result.fail('db down')
    );
    const inspector = new RouterPortInspector(reader, repository);

    const result = await inspector.inspect([makeCandidate()]);

    expect(result.isFailure).toBe(true);
    expect(result.error).toBe('db down');
  });

  it('should not query expectations when there are no routers', async () => {
    const repository = makeRepository([]);
    const inspector = new RouterPortInspector(reader, repository);

    const result = await inspector.inspect([]);

    expect(result.value).toEqual([]);
    expect(repository.listForDevices).not.toHaveBeenCalled();
  });
});
