// Source: src/application/device-monitoring/use-cases/ListRouterPortSpeedsUseCase.ts,
// SetPortExpectedSpeedUseCase.ts, AcceptCurrentPortSpeedsUseCase.ts,
// CheckPortSpeedsUseCase.ts, GetRouterPortSpeedsUseCase.ts

import { ListRouterPortSpeedsUseCase } from '../../../../src/application/device-monitoring/use-cases/ListRouterPortSpeedsUseCase';
import { GetRouterPortSpeedsUseCase } from '../../../../src/application/device-monitoring/use-cases/GetRouterPortSpeedsUseCase';
import {
  PORT_SPEED_ROUTER_NOT_FOUND,
  SetPortExpectedSpeedUseCase
} from '../../../../src/application/device-monitoring/use-cases/SetPortExpectedSpeedUseCase';
import {
  AcceptCurrentPortSpeedsUseCase,
  PORT_SPEED_ROUTER_DID_NOT_ANSWER,
  PORT_SPEED_ROUTER_NOT_READABLE
} from '../../../../src/application/device-monitoring/use-cases/AcceptCurrentPortSpeedsUseCase';
import {
  CheckPortSpeedsUseCase,
  PORT_SPEED_LOW_ALERT_TYPE
} from '../../../../src/application/device-monitoring/use-cases/CheckPortSpeedsUseCase';
import { RouterPortInspector } from '../../../../src/application/device-monitoring/services/RouterPortInspector';
import {
  PORT_HEALTH_ALERT_TYPE,
  PortHealthNotifier
} from '../../../../src/application/device-monitoring/services/PortHealthNotifier';
import {
  EthernetPortReading,
  IPortSpeedTargetsQuery,
  IRouterPortReader,
  PortSpeedRouterCandidate
} from '../../../../src/application/device-monitoring/interfaces';
import {
  IPortExpectedSpeedRepository,
  IRouterHealthThresholdsRepository,
  IRouterPortCountersRepository
} from '../../../../src/domain/device-monitoring/repository';
import { RouterPortCounters } from '../../../../src/domain/device-monitoring/aggregates';
import { RouterHealthThresholds } from '../../../../src/domain/device-monitoring/value-objects';
import { PortExpectedSpeed } from '../../../../src/domain/device-monitoring/entities';
import { DeviceId } from '../../../../src/domain/shared/ids';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';
import {
  AlertNotification,
  IAlertPublisher,
  QUIET_HOURS_SUPPRESSED
} from '../../../../src/application/shared/interfaces/IAlertPublisher';
import { Result } from '../../../../src/domain/shared/core/Result';

const ROUTER_ID = '6f1c2b1e-3c1a-4d8a-9a3e-1b2c3d4e5f60';
const NOW = new Date('2026-10-28T15:00:00Z');

function makeLogger(): jest.Mocked<ILogger> {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
    child: jest.fn().mockReturnThis(),
    setLevel: jest.fn()
  };
}

function makeCandidate(
  overrides: Partial<PortSpeedRouterCandidate> = {}
): PortSpeedRouterCandidate {
  return {
    deviceId: ROUTER_ID,
    deviceName: 'RB4011 Core',
    ipAddress: '10.0.0.1',
    reach: { by: 'server' },
    login: { username: 'admin', password: 'secret', apiPort: 8728 },
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
    rxErrors: null,
    linkDowns: null,
    sfp: null,
    ...overrides
  };
}

function makeExpected(
  portName: string,
  expectedMbps: number,
  alertOnNoLink = false
) {
  return PortExpectedSpeed.create({
    deviceId: DeviceId.parse(ROUTER_ID).value,
    portName,
    expectedMbps,
    alertOnNoLink
  }).value;
}

class InMemoryPortCounters implements IRouterPortCountersRepository {
  readonly rows = new Map<string, RouterPortCounters>();
  readonly saves: RouterPortCounters[][] = [];

  async listForDevices(ids: DeviceId[]) {
    return Result.ok(
      ids
        .map((id) => this.rows.get(id.toString()))
        .filter((c): c is RouterPortCounters => c !== undefined)
    );
  }

  async saveAll(counters: RouterPortCounters[]) {
    this.saves.push(counters);
    counters.forEach((c) => this.rows.set(c.deviceId.toString(), c));
    return Result.ok<void>();
  }
}

// An in-memory store keyed like the table: one row per device and port.
class InMemoryPortExpectedSpeeds
  implements IPortExpectedSpeedRepository
{
  readonly rows = new Map<string, PortExpectedSpeed>();

  constructor(speeds: PortExpectedSpeed[] = []) {
    speeds.forEach((s) =>
      this.rows.set(this.key(s.deviceId, s.portName), s)
    );
  }

  async listForDevices(ids: DeviceId[]) {
    const wanted = new Set(ids.map((id) => id.toString()));
    return Result.ok(
      [...this.rows.values()].filter((s) =>
        wanted.has(s.deviceId.toString())
      )
    );
  }

  async find(deviceId: DeviceId, portName: string) {
    return Result.ok(
      this.rows.get(this.key(deviceId, portName)) ?? null
    );
  }

  async saveAll(speeds: PortExpectedSpeed[]) {
    speeds.forEach((s) =>
      this.rows.set(this.key(s.deviceId, s.portName), s)
    );
    return Result.ok<void>();
  }

  readonly checkStateSaves: PortExpectedSpeed[][] = [];

  async saveCheckState(speeds: PortExpectedSpeed[]) {
    this.checkStateSaves.push(speeds);
    return Result.ok<void>();
  }

  async delete(deviceId: DeviceId, portName: string) {
    this.rows.delete(this.key(deviceId, portName));
    return Result.ok<void>();
  }

  mbpsOf(portName: string): number | undefined {
    return [...this.rows.values()].find(
      (s) => s.portName === portName
    )?.expected.mbps;
  }

  private key(deviceId: DeviceId, portName: string): string {
    return `${deviceId.toString()}|${portName}`;
  }
}

function makeTargets(
  candidate: PortSpeedRouterCandidate | null = makeCandidate()
): jest.Mocked<IPortSpeedTargetsQuery> {
  return {
    listRouters: jest
      .fn()
      .mockResolvedValue(Result.ok(candidate ? [candidate] : [])),
    findRouter: jest.fn().mockResolvedValue(Result.ok(candidate))
  };
}

function makeReader(
  ports: EthernetPortReading[]
): jest.Mocked<IRouterPortReader> {
  return {
    read: jest
      .fn()
      .mockResolvedValue(
        Result.ok({ identity: 'Core-Insetel', ports })
      )
  };
}

describe('ListRouterPortSpeedsUseCase', () => {
  it('[MON-140] should answer every router with when it was checked', async () => {
    const repository = new InMemoryPortExpectedSpeeds([
      makeExpected('ether1', 1000)
    ]);
    const useCase = new ListRouterPortSpeedsUseCase(
      makeTargets(),
      new RouterPortInspector(
        makeReader([makePort({ rateMbps: 100 })]),
        repository,
        new InMemoryPortCounters()
      ),
      makeLogger(),
      () => NOW
    );

    const result = await useCase.execute();

    expect(result.value.checkedAt).toBe(NOW.toISOString());
    expect(result.value.routers).toHaveLength(1);
    expect(result.value.routers[0]!.ports[0]!.verdict).toBe('SLOW');
  });

  it('should fail when the routers cannot be listed', async () => {
    const targets = makeTargets();
    targets.listRouters.mockResolvedValue(Result.fail('db down'));
    const useCase = new ListRouterPortSpeedsUseCase(
      targets,
      new RouterPortInspector(
        makeReader([]),
        new InMemoryPortExpectedSpeeds(),
        new InMemoryPortCounters()
      ),
      makeLogger()
    );

    const result = await useCase.execute();

    expect(result.isFailure).toBe(true);
  });
});

describe('GetRouterPortSpeedsUseCase', () => {
  const make = (targets = makeTargets()) => {
    const reader = makeReader([makePort({ rateMbps: 100 })]);
    return {
      reader,
      targets,
      useCase: new GetRouterPortSpeedsUseCase(
        targets,
        new RouterPortInspector(
          reader,
          new InMemoryPortExpectedSpeeds([
            makeExpected('ether1', 1000)
          ]),
          new InMemoryPortCounters()
        ),
        makeLogger(),
        () => NOW
      )
    };
  };

  it('[MON-150] should read that one router now and judge its ports', async () => {
    const { useCase, targets } = make();

    const result = await useCase.execute({ deviceId: ROUTER_ID });

    expect(targets.findRouter).toHaveBeenCalledWith(ROUTER_ID);
    expect(targets.listRouters).not.toHaveBeenCalled();
    expect(result.value.checkedAt).toBe(NOW.toISOString());
    expect(result.value.router).toMatchObject({
      deviceId: ROUTER_ID,
      identity: 'Core-Insetel',
      readable: true
    });
    expect(result.value.router.ports[0]!.verdict).toBe('SLOW');
  });

  it('[MON-150] should list a router it cannot read with the reason', async () => {
    const { useCase, reader } = make(
      makeTargets(makeCandidate({ login: null }))
    );

    const result = await useCase.execute({ deviceId: ROUTER_ID });

    expect(result.value.router).toMatchObject({
      readable: false,
      reason: 'The router has no username and password saved'
    });
    expect(reader.read).not.toHaveBeenCalled();
  });

  it('should refuse a device that is not one of the MikroTiks', async () => {
    const { useCase } = make(makeTargets(null));

    const result = await useCase.execute({ deviceId: ROUTER_ID });

    expect(result.error).toBe(PORT_SPEED_ROUTER_NOT_FOUND);
  });

  it('should refuse a malformed device id', async () => {
    const { useCase, targets } = make();

    const result = await useCase.execute({ deviceId: 'nope' });

    expect(result.error).toMatch(/^Invalid device ID/);
    expect(targets.findRouter).not.toHaveBeenCalled();
  });
});

describe('SetPortExpectedSpeedUseCase', () => {
  const make = (
    repository = new InMemoryPortExpectedSpeeds(),
    targets = makeTargets()
  ) => ({
    repository,
    targets,
    useCase: new SetPortExpectedSpeedUseCase(
      targets,
      repository,
      makeLogger()
    )
  });

  it('[MON-142] should set the speed a port should link at', async () => {
    const { useCase, repository } = make();

    const result = await useCase.execute({
      deviceId: ROUTER_ID,
      portName: ' ether3 ',
      expectedMbps: 1000
    });

    expect(result.value).toEqual({
      deviceId: ROUTER_ID,
      portName: 'ether3',
      expectedMbps: 1000,
      alertOnNoLink: false
    });
    expect(repository.mbpsOf('ether3')).toBe(1000);
  });

  it('[MON-149] should turn the no-link alert on with a new speed', async () => {
    const { useCase } = make();

    const result = await useCase.execute({
      deviceId: ROUTER_ID,
      portName: 'ether3',
      expectedMbps: 1000,
      alertOnNoLink: true
    });

    expect(result.value.alertOnNoLink).toBe(true);
  });

  it('[MON-149] should keep the no-link alert when it is not given, and turn it off when told', async () => {
    const existing = makeExpected('ether3', 1000, true);
    const { useCase } = make(
      new InMemoryPortExpectedSpeeds([existing])
    );

    const kept = await useCase.execute({
      deviceId: ROUTER_ID,
      portName: 'ether3',
      expectedMbps: 100
    });
    const off = await useCase.execute({
      deviceId: ROUTER_ID,
      portName: 'ether3',
      expectedMbps: 100,
      alertOnNoLink: false
    });

    expect(kept.value.alertOnNoLink).toBe(true);
    expect(off.value.alertOnNoLink).toBe(false);
    expect(existing.alertOnNoLink).toBe(false);
  });

  it('[MON-142] should change a speed already set, keeping its row', async () => {
    const existing = makeExpected('ether3', 1000);
    const { useCase, repository } = make(
      new InMemoryPortExpectedSpeeds([existing])
    );

    await useCase.execute({
      deviceId: ROUTER_ID,
      portName: 'ether3',
      expectedMbps: 100
    });

    expect(repository.rows.size).toBe(1);
    expect(
      [...repository.rows.values()][0]!.id.equals(existing.id)
    ).toBe(true);
    expect(repository.mbpsOf('ether3')).toBe(100);
  });

  it('[MON-142] should clear the speed when given null', async () => {
    const { useCase, repository } = make(
      new InMemoryPortExpectedSpeeds([makeExpected('ether3', 1000)])
    );

    const result = await useCase.execute({
      deviceId: ROUTER_ID,
      portName: 'ether3',
      expectedMbps: null
    });

    expect(result.value.expectedMbps).toBeNull();
    expect(repository.rows.size).toBe(0);
  });

  it('[MON-142] should refuse a speed ports do not link at', async () => {
    const { useCase } = make();

    const result = await useCase.execute({
      deviceId: ROUTER_ID,
      portName: 'ether3',
      expectedMbps: 500
    });

    expect(result.error).toMatch(/must be one of/);
  });

  it('[MON-142] should not read the router', async () => {
    const { useCase, targets } = make();

    await useCase.execute({
      deviceId: ROUTER_ID,
      portName: 'ether3',
      expectedMbps: 1000
    });

    expect(targets.listRouters).not.toHaveBeenCalled();
  });

  it('should refuse a device that is not one of the MikroTiks', async () => {
    const { useCase } = make(undefined, makeTargets(null));

    const result = await useCase.execute({
      deviceId: ROUTER_ID,
      portName: 'ether3',
      expectedMbps: 1000
    });

    expect(result.error).toBe(PORT_SPEED_ROUTER_NOT_FOUND);
  });

  it('should refuse a malformed device id', async () => {
    const { useCase } = make();

    const result = await useCase.execute({
      deviceId: 'nope',
      portName: 'ether3',
      expectedMbps: 1000
    });

    expect(result.error).toMatch(/^Invalid device ID/);
  });
});

describe('AcceptCurrentPortSpeedsUseCase', () => {
  const make = (
    ports: EthernetPortReading[],
    repository = new InMemoryPortExpectedSpeeds(),
    targets = makeTargets()
  ) => {
    const reader = makeReader(ports);
    return {
      reader,
      repository,
      useCase: new AcceptCurrentPortSpeedsUseCase(
        targets,
        new RouterPortInspector(
          reader,
          repository,
          new InMemoryPortCounters()
        ),
        repository,
        makeLogger()
      )
    };
  };

  it("[MON-144] should make every linked port's rate its expected speed", async () => {
    const { useCase, repository } = make([
      makePort({ name: 'ether1', rateMbps: 1000 }),
      makePort({ name: 'ether2', rateMbps: 100 }),
      makePort({ name: 'ether3', linked: false, rateMbps: null })
    ]);

    const result = await useCase.execute({ deviceId: ROUTER_ID });

    expect(repository.mbpsOf('ether1')).toBe(1000);
    expect(repository.mbpsOf('ether2')).toBe(100);
    expect(repository.mbpsOf('ether3')).toBeUndefined();
    expect(
      result.value.ports.map((p) => [p.name, p.verdict])
    ).toEqual([
      ['ether1', 'OK'],
      ['ether2', 'OK'],
      ['ether3', 'NO_LINK']
    ]);
  });

  it("[MON-144] should overwrite a speed already set and keep an unlinked port's", async () => {
    const { useCase, repository } = make(
      [
        makePort({ name: 'ether1', rateMbps: 100 }),
        makePort({ name: 'ether2', linked: false, rateMbps: null })
      ],
      new InMemoryPortExpectedSpeeds([
        makeExpected('ether1', 1000),
        makeExpected('ether2', 1000)
      ])
    );

    const result = await useCase.execute({ deviceId: ROUTER_ID });

    expect(repository.mbpsOf('ether1')).toBe(100);
    expect(repository.mbpsOf('ether2')).toBe(1000);
    expect(result.value.ports[1]).toMatchObject({
      name: 'ether2',
      expectedMbps: 1000,
      verdict: 'NO_LINK'
    });
  });

  it('[MON-144] should skip a linked port with no rate', async () => {
    const { useCase, repository } = make([
      makePort({ name: 'ether1', rateMbps: null })
    ]);

    await useCase.execute({ deviceId: ROUTER_ID });

    expect(repository.rows.size).toBe(0);
  });

  it('[MON-145] should refuse a router it cannot read', async () => {
    const { useCase, reader } = make(
      [],
      undefined,
      makeTargets(makeCandidate({ login: null }))
    );

    const result = await useCase.execute({ deviceId: ROUTER_ID });

    expect(result.error).toBe(
      `${PORT_SPEED_ROUTER_NOT_READABLE}: The router has no username and password saved`
    );
    expect(reader.read).not.toHaveBeenCalled();
  });

  it('should fail and change nothing when the router does not answer', async () => {
    const { useCase, reader, repository } = make(
      [],
      new InMemoryPortExpectedSpeeds([makeExpected('ether1', 1000)])
    );
    reader.read.mockResolvedValue(
      Result.fail('RouterOS API error: timeout')
    );

    const result = await useCase.execute({ deviceId: ROUTER_ID });

    expect(result.error).toBe(
      `${PORT_SPEED_ROUTER_DID_NOT_ANSWER}: RouterOS API error: timeout`
    );
    expect(repository.mbpsOf('ether1')).toBe(1000);
  });

  it('should refuse a device that is not one of the MikroTiks', async () => {
    const { useCase } = make([], undefined, makeTargets(null));

    const result = await useCase.execute({ deviceId: ROUTER_ID });

    expect(result.error).toBe(PORT_SPEED_ROUTER_NOT_FOUND);
  });
});

describe('CheckPortSpeedsUseCase', () => {
  const LATER = new Date('2026-10-28T15:10:00Z');

  function makePublisher(
    result: Result<void> = Result.ok<void>()
  ): jest.Mocked<IAlertPublisher> & { sent: AlertNotification[] } {
    const sent: AlertNotification[] = [];
    return {
      sent,
      publish: jest.fn(async (n: AlertNotification) => {
        sent.push(n);
        return result;
      })
    };
  }

  function makeThresholds(): jest.Mocked<IRouterHealthThresholdsRepository> {
    return {
      get: jest
        .fn()
        .mockResolvedValue(
          Result.ok(RouterHealthThresholds.defaults())
        ),
      save: jest.fn()
    };
  }

  function makeUseCase(
    reader: IRouterPortReader,
    repository: InMemoryPortExpectedSpeeds,
    publisher: IAlertPublisher,
    targets: IPortSpeedTargetsQuery = makeTargets(),
    counters = new InMemoryPortCounters(),
    thresholds = makeThresholds()
  ) {
    return new CheckPortSpeedsUseCase(
      targets,
      new RouterPortInspector(reader, repository, counters),
      repository,
      counters,
      thresholds,
      publisher,
      new PortHealthNotifier(publisher, makeLogger()),
      makeLogger()
    );
  }

  it('[MON-147] should not alert on the first slow check', async () => {
    const repository = new InMemoryPortExpectedSpeeds([
      makeExpected('ether1', 1000)
    ]);
    const publisher = makePublisher();

    const result = await makeUseCase(
      makeReader([makePort({ rateMbps: 100 })]),
      repository,
      publisher
    ).execute({ now: NOW });

    expect(result.value).toEqual({
      routersChecked: 1,
      skipped: [],
      raised: 0,
      recovered: 0,
      portIssuesRaised: 0,
      portIssuesRecovered: 0
    });
    expect(publisher.publish).not.toHaveBeenCalled();
    expect(repository.checkStateSaves[0][0].slowChecks).toBe(1);
  });

  it('[MON-147] should alert on the second slow check in a row, naming the port and both speeds', async () => {
    const repository = new InMemoryPortExpectedSpeeds([
      makeExpected('ether3', 1000)
    ]);
    const publisher = makePublisher();
    const useCase = makeUseCase(
      makeReader([
        makePort({
          name: 'ether3',
          comment: 'Backhaul',
          rateMbps: 100
        })
      ]),
      repository,
      publisher
    );

    await useCase.execute({ now: NOW });
    const result = await useCase.execute({ now: LATER });

    expect(result.value.raised).toBe(1);
    expect(publisher.sent).toEqual([
      expect.objectContaining({
        deviceId: ROUTER_ID,
        type: PORT_SPEED_LOW_ALERT_TYPE,
        resolved: false,
        summary:
          'El puerto ether3 (Backhaul) de "RB4011 Core" está a 100 Mbps, debería estar a 1 Gbps',
        detail: null,
        occurredAt: LATER
      })
    ]);
  });

  it('[MON-147] should alert only once while the port stays slow', async () => {
    const repository = new InMemoryPortExpectedSpeeds([
      makeExpected('ether1', 1000)
    ]);
    const publisher = makePublisher();
    const useCase = makeUseCase(
      makeReader([makePort({ rateMbps: 100 })]),
      repository,
      publisher
    );

    for (let i = 0; i < 4; i++) await useCase.execute({ now: NOW });

    expect(publisher.publish).toHaveBeenCalledTimes(1);
  });

  it('[MON-143] should count half duplex as slow', async () => {
    const repository = new InMemoryPortExpectedSpeeds([
      makeExpected('ether1', 1000)
    ]);
    const publisher = makePublisher();
    const useCase = makeUseCase(
      makeReader([makePort({ fullDuplex: false })]),
      repository,
      publisher
    );

    await useCase.execute({ now: NOW });
    await useCase.execute({ now: LATER });

    expect(publisher.sent[0].summary).toBe(
      'El puerto ether1 de "RB4011 Core" está a 1 Gbps en half duplex, debería estar a 1 Gbps'
    );
  });

  it('[MON-147] should send a recovery once the port meets its speed again', async () => {
    const expected = makeExpected('ether1', 1000);
    expected.recordCheck('SHORT', NOW);
    expected.recordCheck('SHORT', NOW);
    const repository = new InMemoryPortExpectedSpeeds([expected]);
    const publisher = makePublisher();

    const result = await makeUseCase(
      makeReader([makePort()]),
      repository,
      publisher
    ).execute({ now: LATER });

    expect(result.value.recovered).toBe(1);
    expect(publisher.sent).toEqual([
      expect.objectContaining({
        resolved: true,
        type: PORT_SPEED_LOW_ALERT_TYPE,
        summary: 'El puerto ether1 de "RB4011 Core" volvió a 1 Gbps'
      })
    ]);
    expect(expected.alertedAt).toBeNull();
  });

  it('[MON-147] should neither alert nor recover a port without a link', async () => {
    const expected = makeExpected('ether1', 1000);
    expected.recordCheck('SHORT', NOW);
    expected.recordCheck('SHORT', NOW);
    const repository = new InMemoryPortExpectedSpeeds([
      expected,
      makeExpected('ether2', 1000)
    ]);
    const publisher = makePublisher();

    await makeUseCase(
      makeReader([
        makePort({ linked: false, rateMbps: null }),
        makePort({ name: 'ether2', linked: false, rateMbps: null })
      ]),
      repository,
      publisher
    ).execute({ now: LATER });

    expect(publisher.publish).not.toHaveBeenCalled();
    expect(expected.alertedAt).toEqual(NOW);
  });

  it('[MON-149] should alert on a port that lost its link when it alerts on no link', async () => {
    const repository = new InMemoryPortExpectedSpeeds([
      makeExpected('ether3', 1000, true)
    ]);
    const publisher = makePublisher();
    const useCase = makeUseCase(
      makeReader([
        makePort({
          name: 'ether3',
          comment: 'Backhaul',
          linked: false,
          rateMbps: null,
          fullDuplex: null
        })
      ]),
      repository,
      publisher
    );

    await useCase.execute({ now: NOW });
    expect(publisher.publish).not.toHaveBeenCalled();
    await useCase.execute({ now: LATER });

    expect(publisher.sent).toEqual([
      expect.objectContaining({
        resolved: false,
        type: PORT_SPEED_LOW_ALERT_TYPE,
        summary:
          'El puerto ether3 (Backhaul) de "RB4011 Core" está sin enlace, debería estar a 1 Gbps'
      })
    ]);
  });

  it('[MON-149] should recover once the link is back at its speed', async () => {
    const expected = makeExpected('ether1', 1000, true);
    expected.recordCheck('SHORT', NOW);
    expected.recordCheck('SHORT', NOW);
    const publisher = makePublisher();

    await makeUseCase(
      makeReader([makePort()]),
      new InMemoryPortExpectedSpeeds([expected]),
      publisher
    ).execute({ now: LATER });

    expect(publisher.sent[0]).toMatchObject({
      resolved: true,
      summary: 'El puerto ether1 de "RB4011 Core" volvió a 1 Gbps'
    });
  });

  it('[MON-149] should name a port without link among several in one notice', async () => {
    const repository = new InMemoryPortExpectedSpeeds([
      makeExpected('ether1', 1000),
      makeExpected('ether2', 1000, true)
    ]);
    const publisher = makePublisher();
    const useCase = makeUseCase(
      makeReader([
        makePort({ rateMbps: 100 }),
        makePort({ name: 'ether2', linked: false, rateMbps: null })
      ]),
      repository,
      publisher
    );

    await useCase.execute({ now: NOW });
    await useCase.execute({ now: LATER });

    expect(publisher.sent).toHaveLength(1);
    expect(publisher.sent[0]).toMatchObject({
      summary:
        '2 puertos de "RB4011 Core" están sin enlace o más lentos de lo que deberían',
      detail:
        '• ether1: 100 Mbps, debería estar a 1 Gbps\n• ether2: sin enlace, debería estar a 1 Gbps'
    });
  });

  it('[MON-147] should break the streak when a check has nothing to judge', async () => {
    const repository = new InMemoryPortExpectedSpeeds([
      makeExpected('ether1', 1000)
    ]);
    const publisher = makePublisher();
    const reader = makeReader([makePort({ rateMbps: 100 })]);
    const useCase = makeUseCase(reader, repository, publisher);

    await useCase.execute({ now: NOW });
    reader.read.mockResolvedValueOnce(
      Result.ok({ identity: 'Core', ports: [] })
    );
    await useCase.execute({ now: NOW });
    await useCase.execute({ now: LATER });

    expect(publisher.publish).not.toHaveBeenCalled();
  });

  it('[MON-147] should leave the state of a router that did not answer as it was', async () => {
    const expected = makeExpected('ether1', 1000);
    expected.recordCheck('SHORT', NOW);
    const repository = new InMemoryPortExpectedSpeeds([expected]);
    const reader: jest.Mocked<IRouterPortReader> = {
      read: jest.fn().mockResolvedValue(Result.fail('timed out'))
    };

    const result = await makeUseCase(
      reader,
      repository,
      makePublisher()
    ).execute({ now: LATER });

    expect(result.value).toEqual({
      routersChecked: 0,
      skipped: [
        { deviceId: ROUTER_ID, name: 'RB4011 Core', why: 'timed out' }
      ],
      raised: 0,
      recovered: 0,
      portIssuesRaised: 0,
      portIssuesRecovered: 0
    });
    expect(expected.slowChecks).toBe(1);
    expect(repository.checkStateSaves).toEqual([[]]);
  });

  it('[MON-192] should read a router without any expected speed for its counters', async () => {
    const reader = makeReader([
      makePort({ rxErrors: 5, linkDowns: 1 })
    ]);
    const counters = new InMemoryPortCounters();

    const result = await makeUseCase(
      reader,
      new InMemoryPortExpectedSpeeds(),
      makePublisher(),
      makeTargets(),
      counters
    ).execute({ now: NOW });

    expect(reader.read).toHaveBeenCalledTimes(1);
    expect(result.value.routersChecked).toBe(1);
    expect(
      counters.rows.get(ROUTER_ID)!.port('ether1')
    ).toMatchObject({
      rxErrors: 5,
      linkDowns: 1,
      readAt: NOW,
      errorsAdded: null
    });
  });

  it('[MON-192] should keep the counters of a router that did not answer', async () => {
    const counters = new InMemoryPortCounters();
    const reader = makeReader([makePort({ rxErrors: 5 })]);
    const useCase = makeUseCase(
      reader,
      new InMemoryPortExpectedSpeeds(),
      makePublisher(),
      makeTargets(),
      counters
    );
    await useCase.execute({ now: NOW });

    reader.read.mockResolvedValue(Result.fail('timed out'));
    await useCase.execute({ now: LATER });

    expect(counters.saves[1]).toEqual([]);
    expect(
      counters.rows.get(ROUTER_ID)!.port('ether1')!.readAt
    ).toEqual(NOW);
  });

  it('[MON-197] should tell of a port whose errors grew on two checks in a row, and of its recovery', async () => {
    const publisher = makePublisher();
    const reader = makeReader([]);
    const useCase = makeUseCase(
      reader,
      new InMemoryPortExpectedSpeeds(),
      publisher
    );
    const errors = (rxErrors: number) =>
      reader.read.mockResolvedValue(
        Result.ok({
          identity: 'Core',
          ports: [makePort({ comment: 'Torre norte', rxErrors })]
        })
      );

    for (const count of [10, 20, 32]) {
      errors(count);
      await useCase.execute({ now: LATER });
    }
    for (let i = 0; i < 2; i++) await useCase.execute({ now: LATER });

    expect(publisher.sent).toEqual([
      expect.objectContaining({
        type: PORT_HEALTH_ALERT_TYPE,
        resolved: false,
        summary:
          'El puerto ether1 (Torre norte) de "RB4011 Core" sigue sumando errores (+12 en el último chequeo)'
      }),
      expect.objectContaining({
        type: PORT_HEALTH_ALERT_TYPE,
        resolved: true,
        summary:
          'El puerto ether1 (Torre norte) de "RB4011 Core" dejó de sumar errores'
      })
    ]);
  });

  it('[MON-196] should fail when the thresholds cannot be read', async () => {
    const thresholds = makeThresholds();
    thresholds.get.mockResolvedValue(Result.fail('db down'));

    const result = await makeUseCase(
      makeReader([]),
      new InMemoryPortExpectedSpeeds(),
      makePublisher(),
      makeTargets(),
      new InMemoryPortCounters(),
      thresholds
    ).execute({ now: NOW });

    expect(result.error).toBe('db down');
  });

  it('[MON-148] should send one notice for several ports of a router', async () => {
    const repository = new InMemoryPortExpectedSpeeds([
      makeExpected('ether1', 1000),
      makeExpected('ether2', 1000)
    ]);
    const publisher = makePublisher();
    const useCase = makeUseCase(
      makeReader([
        makePort({ rateMbps: 100, comment: 'Torre norte' }),
        makePort({ name: 'ether2', rateMbps: 10 })
      ]),
      repository,
      publisher
    );

    await useCase.execute({ now: NOW });
    await useCase.execute({ now: LATER });

    expect(publisher.sent).toHaveLength(1);
    expect(publisher.sent[0].summary).toBe(
      '2 puertos de "RB4011 Core" están más lentos de lo que deberían'
    );
    expect(publisher.sent[0].detail).toBe(
      '• ether1 (Torre norte): 100 Mbps, debería estar a 1 Gbps\n• ether2: 10 Mbps, debería estar a 1 Gbps'
    );
  });

  it('[MON-148] should keep the alert raised when its notice is held back', async () => {
    const repository = new InMemoryPortExpectedSpeeds([
      makeExpected('ether1', 1000)
    ]);
    const publisher = makePublisher(
      Result.fail<void>(QUIET_HOURS_SUPPRESSED)
    );
    const useCase = makeUseCase(
      makeReader([makePort({ rateMbps: 100 })]),
      repository,
      publisher
    );

    await useCase.execute({ now: NOW });
    await useCase.execute({ now: LATER });
    await useCase.execute({ now: LATER });

    expect(publisher.publish).toHaveBeenCalledTimes(1);
  });

  it('[MON-147] should fail when the routers cannot be listed', async () => {
    const targets = makeTargets();
    targets.listRouters.mockResolvedValue(Result.fail('db down'));

    const result = await makeUseCase(
      makeReader([]),
      new InMemoryPortExpectedSpeeds(),
      makePublisher(),
      targets
    ).execute({ now: NOW });

    expect(result.isFailure).toBe(true);
  });
});
