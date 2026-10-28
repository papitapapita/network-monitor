// Source: src/application/device-monitoring/use-cases/ListRouterPortSpeedsUseCase.ts,
// SetPortExpectedSpeedUseCase.ts, AcceptCurrentPortSpeedsUseCase.ts

import { ListRouterPortSpeedsUseCase } from '../../../../src/application/device-monitoring/use-cases/ListRouterPortSpeedsUseCase';
import {
  PORT_SPEED_ROUTER_NOT_FOUND,
  SetPortExpectedSpeedUseCase
} from '../../../../src/application/device-monitoring/use-cases/SetPortExpectedSpeedUseCase';
import {
  AcceptCurrentPortSpeedsUseCase,
  PORT_SPEED_ROUTER_DID_NOT_ANSWER,
  PORT_SPEED_ROUTER_NOT_READABLE
} from '../../../../src/application/device-monitoring/use-cases/AcceptCurrentPortSpeedsUseCase';
import { RouterPortInspector } from '../../../../src/application/device-monitoring/services/RouterPortInspector';
import {
  EthernetPortReading,
  IPortSpeedTargetsQuery,
  IRouterPortReader,
  PortSpeedRouterCandidate
} from '../../../../src/application/device-monitoring/interfaces';
import { IPortExpectedSpeedRepository } from '../../../../src/domain/device-monitoring/repository';
import { PortExpectedSpeed } from '../../../../src/domain/device-monitoring/entities';
import { DeviceId } from '../../../../src/domain/shared/ids';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';
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
    ...overrides
  };
}

function makeExpected(portName: string, expectedMbps: number) {
  return PortExpectedSpeed.create({
    deviceId: DeviceId.parse(ROUTER_ID).value,
    portName,
    expectedMbps
  }).value;
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
        repository
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
        new InMemoryPortExpectedSpeeds()
      ),
      makeLogger()
    );

    const result = await useCase.execute();

    expect(result.isFailure).toBe(true);
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
      expectedMbps: 1000
    });
    expect(repository.mbpsOf('ether3')).toBe(1000);
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
        new RouterPortInspector(reader, repository),
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
