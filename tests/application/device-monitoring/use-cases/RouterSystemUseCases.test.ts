// Source: src/application/device-monitoring/use-cases/ListRouterSystemsUseCase.ts,
// GetRouterSystemUseCase.ts, CheckRouterSystemsUseCase.ts,
// GetRouterHealthThresholdsUseCase.ts, UpdateRouterHealthThresholdsUseCase.ts,
// GetRouterAuditUseCase.ts, services/RouterSystemRecorder.ts

import { ListRouterSystemsUseCase } from '../../../../src/application/device-monitoring/use-cases/ListRouterSystemsUseCase';
import { GetRouterSystemUseCase } from '../../../../src/application/device-monitoring/use-cases/GetRouterSystemUseCase';
import { CheckRouterSystemsUseCase } from '../../../../src/application/device-monitoring/use-cases/CheckRouterSystemsUseCase';
import { GetRouterHealthThresholdsUseCase } from '../../../../src/application/device-monitoring/use-cases/GetRouterHealthThresholdsUseCase';
import { UpdateRouterHealthThresholdsUseCase } from '../../../../src/application/device-monitoring/use-cases/UpdateRouterHealthThresholdsUseCase';
import { GetRouterAuditUseCase } from '../../../../src/application/device-monitoring/use-cases/GetRouterAuditUseCase';
import { PORT_SPEED_ROUTER_NOT_FOUND } from '../../../../src/application/device-monitoring/use-cases/SetPortExpectedSpeedUseCase';
import { RouterSystemRecorder } from '../../../../src/application/device-monitoring/services/RouterSystemRecorder';
import { RouterSystemNotifier } from '../../../../src/application/device-monitoring/services/RouterSystemNotifier';
import {
  IPortSpeedTargetsQuery,
  IReportedOutageQuery,
  IRouterSystemReader,
  PortSpeedRouterCandidate,
  RouterSystemReading
} from '../../../../src/application/device-monitoring/interfaces';
import {
  IRouterHealthThresholdsRepository,
  IRouterSystemStateRepository
} from '../../../../src/domain/device-monitoring/repository';
import { RouterSystemState } from '../../../../src/domain/device-monitoring/aggregates';
import { RouterHealthThresholds } from '../../../../src/domain/device-monitoring/value-objects';
import { IAlertPublisher } from '../../../../src/application/shared/interfaces';
import { DeviceId } from '../../../../src/domain/shared/ids';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';
import { Result } from '../../../../src/domain/shared/core/Result';

const ROUTER_ID = '6f1c2b1e-3c1a-4d8a-9a3e-1b2c3d4e5f60';
const OTHER_ID = '7a2d3c4b-5e6f-4a1b-8c9d-0e1f2a3b4c5d';
const EARLIER = new Date('2026-10-28T14:50:00Z');
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

// the system details the DTO shows: the reading without its security facts
function systemDetails() {
  const { security: _security, ...system } = makeReading();
  return system;
}

function makeReading(
  overrides: Partial<RouterSystemReading> = {}
): RouterSystemReading {
  return {
    identity: 'Core-Insetel',
    model: 'RB4011iGS+',
    serialNumber: 'D4440E1A2B3C',
    macAddress: 'DC:2C:6E:00:00:01',
    boardName: 'RB4011iGS+',
    routerOsVersion: '7.15.3',
    currentFirmware: '7.15.3',
    upgradeFirmware: '7.15.3',
    uptimeSeconds: 86400,
    cpuLoadPercent: 7,
    freeMemoryBytes: 800,
    totalMemoryBytes: 1024,
    freeHddBytes: 400,
    totalHddBytes: 512,
    voltage: 24.1,
    temperatureC: 41,
    security: null,
    ...overrides
  };
}

function makeState(id: string, reading: RouterSystemReading | null) {
  const state = RouterSystemState.createInitial(
    DeviceId.parse(id).value,
    EARLIER
  );
  if (reading) state.recordReading(reading, EARLIER);
  return state;
}

function setup(
  candidates: PortSpeedRouterCandidate[] = [makeCandidate()],
  stored: RouterSystemState[] = []
) {
  const targets: jest.Mocked<IPortSpeedTargetsQuery> = {
    listRouters: jest.fn().mockResolvedValue(Result.ok(candidates)),
    findRouter: jest.fn(async (id: string) =>
      Result.ok(candidates.find((c) => c.deviceId === id) ?? null)
    )
  };
  const reader: jest.Mocked<IRouterSystemReader> = {
    read: jest.fn().mockResolvedValue(Result.ok(makeReading()))
  };
  const repository: jest.Mocked<IRouterSystemStateRepository> = {
    listForDevices: jest.fn().mockResolvedValue(Result.ok(stored)),
    findByDeviceId: jest.fn(),
    saveAll: jest.fn().mockResolvedValue(Result.ok())
  };
  const recorder = new RouterSystemRecorder(reader, repository);
  const publisher: jest.Mocked<IAlertPublisher> = {
    publish: jest.fn().mockResolvedValue(Result.ok())
  };
  const outages: jest.Mocked<IReportedOutageQuery> = {
    wasReportedDown: jest.fn().mockResolvedValue(Result.ok(false))
  };
  const thresholds: jest.Mocked<IRouterHealthThresholdsRepository> = {
    get: jest
      .fn()
      .mockResolvedValue(
        Result.ok(RouterHealthThresholds.defaults())
      ),
    save: jest.fn().mockResolvedValue(Result.ok())
  };
  const notifier = new RouterSystemNotifier(
    publisher,
    outages,
    makeLogger()
  );
  return {
    targets,
    reader,
    repository,
    recorder,
    publisher,
    outages,
    thresholds,
    notifier
  };
}

const check = (s: ReturnType<typeof setup>) =>
  new CheckRouterSystemsUseCase(
    s.targets,
    s.recorder,
    s.thresholds,
    s.notifier,
    makeLogger()
  );

describe('RouterSystemRecorder', () => {
  it('[MON-161] should read a router and keep what it said', async () => {
    const { recorder, reader, repository } = setup();

    const result = await recorder.record([makeCandidate()], NOW);

    expect(reader.read).toHaveBeenCalledWith({
      host: '10.0.0.1',
      login: { username: 'admin', password: 'secret', apiPort: 8728 },
      agentId: null
    });
    const [saved] = repository.saveAll.mock.calls[0]![0];
    expect(saved!.reading).toEqual(makeReading());
    expect(saved!.readAt).toEqual(NOW);
    expect(result.value[0]!.reason).toBeNull();
  });

  it('[MON-161] should keep the last reading beside a failed read', async () => {
    const { recorder, reader, repository } = setup(
      [makeCandidate()],
      [makeState(ROUTER_ID, makeReading({ identity: 'Before' }))]
    );
    reader.read.mockResolvedValue(
      Result.fail('RouterOS API error: timeout')
    );

    await recorder.record([makeCandidate()], NOW);

    const [saved] = repository.saveAll.mock.calls[0]![0];
    expect(saved!.reading?.identity).toBe('Before');
    expect(saved!.readAt).toEqual(EARLIER);
    expect(saved!.lastError).toBe('RouterOS API error: timeout');
    expect(saved!.attemptedAt).toEqual(NOW);
  });

  it('[MON-161] should neither read nor save a router that cannot be read', async () => {
    const candidate = makeCandidate({ login: null });
    const { recorder, reader, repository } = setup([candidate]);

    const result = await recorder.record([candidate], NOW);

    expect(reader.read).not.toHaveBeenCalled();
    expect(repository.saveAll).toHaveBeenCalledWith([]);
    expect(result.value[0]!.reason).toBe(
      'The router has no username and password saved'
    );
  });

  it('[MON-161] should read through the agent the router sits behind', async () => {
    const candidate = makeCandidate({
      reach: { by: 'agent', agentId: 'a-1' }
    });
    const { recorder, reader } = setup([candidate]);

    await recorder.record([candidate], NOW);

    expect(reader.read).toHaveBeenCalledWith(
      expect.objectContaining({ agentId: 'a-1' })
    );
  });

  it('[MON-170] should say when a router was found to have restarted', async () => {
    const { recorder, reader } = setup(
      [makeCandidate()],
      [makeState(ROUTER_ID, makeReading({ uptimeSeconds: 86400 }))]
    );
    reader.read.mockResolvedValue(
      Result.ok(makeReading({ uptimeSeconds: 120 }))
    );

    const result = await recorder.record([makeCandidate()], NOW);

    expect(result.value[0]!.rebootedAt).toEqual(
      new Date(NOW.getTime() - 120_000)
    );
  });

  it('[MON-173] should judge health only when given thresholds', async () => {
    const { recorder, reader } = setup();
    reader.read.mockResolvedValue(
      Result.ok(makeReading({ temperatureC: 80 }))
    );

    const unjudged = await recorder.record([makeCandidate()], NOW);
    const judged = await recorder.record(
      [makeCandidate()],
      NOW,
      RouterHealthThresholds.defaults()
    );

    expect(unjudged.value[0]!.health).toBeNull();
    expect(judged.value[0]!.health).toEqual({
      raised: ['TEMPERATURE'],
      recovered: []
    });
  });

  it('should fail when the states cannot be saved', async () => {
    const { recorder, repository } = setup();
    repository.saveAll.mockResolvedValue(Result.fail('db down'));

    const result = await recorder.record([makeCandidate()], NOW);

    expect(result.error).toBe('db down');
  });
});

describe('ListRouterSystemsUseCase', () => {
  it('[MON-162] [MON-175] should list every router with its last reading, without reading any', async () => {
    const other = makeCandidate({
      deviceId: OTHER_ID,
      deviceName: 'Switch Norte',
      ipAddress: null
    });
    const { targets, recorder, reader } = setup(
      [makeCandidate(), other],
      [makeState(ROUTER_ID, makeReading())]
    );
    const useCase = new ListRouterSystemsUseCase(
      targets,
      recorder,
      makeLogger()
    );

    const result = await useCase.execute();

    expect(reader.read).not.toHaveBeenCalled();
    expect(result.value.routers).toEqual([
      {
        deviceId: ROUTER_ID,
        name: 'RB4011 Core',
        ipAddress: '10.0.0.1',
        readable: true,
        reason: null,
        system: systemDetails(),
        readAt: EARLIER.toISOString(),
        attemptedAt: EARLIER.toISOString(),
        lastError: null,
        bootedAt: new Date(
          EARLIER.getTime() - 86400 * 1000
        ).toISOString(),
        healthIssues: []
      },
      {
        deviceId: OTHER_ID,
        name: 'Switch Norte',
        ipAddress: null,
        readable: false,
        reason: 'The router has no IP address',
        system: null,
        readAt: null,
        attemptedAt: null,
        lastError: null,
        bootedAt: null,
        healthIssues: []
      }
    ]);
  });

  it('should pass a failed query on', async () => {
    const { targets, recorder } = setup();
    targets.listRouters.mockResolvedValue(Result.fail('db down'));

    const result = await new ListRouterSystemsUseCase(
      targets,
      recorder,
      makeLogger()
    ).execute();

    expect(result.error).toBe('db down');
  });
});

describe('GetRouterSystemUseCase', () => {
  const make = (s: ReturnType<typeof setup>) =>
    new GetRouterSystemUseCase(
      s.targets,
      s.recorder,
      s.notifier,
      makeLogger(),
      () => NOW
    );

  it('[MON-163] should read one router now and keep the reading', async () => {
    const s = setup();

    const result = await make(s).execute({ deviceId: ROUTER_ID });

    expect(s.reader.read).toHaveBeenCalledTimes(1);
    expect(s.repository.saveAll).toHaveBeenCalledTimes(1);
    expect(result.value.router).toMatchObject({
      deviceId: ROUTER_ID,
      system: systemDetails(),
      readAt: NOW.toISOString(),
      lastError: null
    });
  });

  it('[MON-163] should answer a router that did not answer with its error', async () => {
    const s = setup();
    s.reader.read.mockResolvedValue(
      Result.fail('RouterOS API error: timeout')
    );

    const result = await make(s).execute({ deviceId: ROUTER_ID });

    expect(result.value.router).toMatchObject({
      system: null,
      lastError: 'RouterOS API error: timeout'
    });
  });

  it('[MON-171] should tell of a reboot this read reveals', async () => {
    const s = setup(
      [makeCandidate()],
      [makeState(ROUTER_ID, makeReading())]
    );
    s.reader.read.mockResolvedValue(
      Result.ok(makeReading({ uptimeSeconds: 60 }))
    );

    await make(s).execute({ deviceId: ROUTER_ID });

    expect(s.publisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'router_rebooted' })
    );
  });

  it('[MON-163] should not judge health on a read on demand', async () => {
    const s = setup();
    s.reader.read.mockResolvedValue(
      Result.ok(makeReading({ temperatureC: 90 }))
    );

    await make(s).execute({ deviceId: ROUTER_ID });

    expect(s.publisher.publish).not.toHaveBeenCalled();
    expect(
      s.repository.saveAll.mock.calls[0]![0][0]!.healthIssues
    ).toEqual([]);
  });

  it('[MON-163] should refuse a device that is not one of the routers', async () => {
    const s = setup();

    const result = await make(s).execute({ deviceId: OTHER_ID });

    expect(result.error).toBe(PORT_SPEED_ROUTER_NOT_FOUND);
    expect(s.reader.read).not.toHaveBeenCalled();
  });

  it('should refuse a malformed id', async () => {
    const result = await make(setup()).execute({ deviceId: 'nope' });

    expect(result.error).toMatch(/^Invalid device ID/);
  });
});

describe('CheckRouterSystemsUseCase', () => {
  it('[MON-161] should read every router and say which were read, skipped or failed', async () => {
    const failing = makeCandidate({
      deviceId: OTHER_ID,
      deviceName: 'Switch Norte',
      ipAddress: '10.0.0.2'
    });
    const unreadable = makeCandidate({
      deviceId: '8b3e4d5c-6f7a-4b2c-9d0e-1f2a3b4c5d6e',
      deviceName: 'Sin IP',
      ipAddress: null
    });
    const s = setup([makeCandidate(), failing, unreadable]);
    s.reader.read.mockImplementation(async (c) =>
      c.host === '10.0.0.2'
        ? Result.fail('RouterOS API error: timeout')
        : Result.ok(makeReading())
    );

    const result = await check(s).execute({ now: NOW });

    expect(result.value).toEqual({
      rebooted: 0,
      healthRaised: 0,
      healthRecovered: 0,
      routersRead: 1,
      skipped: [
        {
          deviceId: unreadable.deviceId,
          name: 'Sin IP',
          why: 'The router has no IP address'
        }
      ],
      failed: [
        {
          deviceId: OTHER_ID,
          name: 'Switch Norte',
          why: 'RouterOS API error: timeout'
        }
      ]
    });
    expect(s.repository.saveAll.mock.calls[0]![0]).toHaveLength(2);
  });

  it('[MON-161] should do nothing when there are no routers', async () => {
    const s = setup([]);

    const result = await check(s).execute({ now: NOW });

    expect(result.value).toEqual({
      routersRead: 0,
      skipped: [],
      failed: [],
      rebooted: 0,
      healthRaised: 0,
      healthRecovered: 0
    });
    expect(s.repository.listForDevices).not.toHaveBeenCalled();
  });

  it('[MON-171] should tell of a reboot the ping check did not report', async () => {
    const s = setup(
      [makeCandidate()],
      [makeState(ROUTER_ID, makeReading())]
    );
    s.reader.read.mockResolvedValue(
      Result.ok(makeReading({ uptimeSeconds: 300 }))
    );

    const result = await check(s).execute({ now: NOW });

    const rebootedAt = new Date(NOW.getTime() - 300_000);
    expect(result.value.rebooted).toBe(1);
    expect(s.outages.wasReportedDown).toHaveBeenCalledWith(
      ROUTER_ID,
      new Date(rebootedAt.getTime() - 10 * 60_000),
      NOW
    );
    expect(s.publisher.publish).toHaveBeenCalledWith({
      deviceId: ROUTER_ID,
      severity: 'WARNING',
      source: 'Estado de routers',
      summary: 'El router "RB4011 Core" se reinició',
      detail: 'El ping no alcanzó a detectarlo caído.',
      occurredAt: rebootedAt,
      resolved: false,
      type: 'router_rebooted'
    });
  });

  it('[MON-171] should stay silent about a reboot the ping check reported', async () => {
    const s = setup(
      [makeCandidate()],
      [makeState(ROUTER_ID, makeReading())]
    );
    s.reader.read.mockResolvedValue(
      Result.ok(makeReading({ uptimeSeconds: 300 }))
    );
    s.outages.wasReportedDown.mockResolvedValue(Result.ok(true));

    const result = await check(s).execute({ now: NOW });

    expect(result.value.rebooted).toBe(1);
    expect(s.publisher.publish).not.toHaveBeenCalled();
  });

  it('[MON-171] should still tell of the reboot when the down alerts cannot be read', async () => {
    const s = setup(
      [makeCandidate()],
      [makeState(ROUTER_ID, makeReading())]
    );
    s.reader.read.mockResolvedValue(
      Result.ok(makeReading({ uptimeSeconds: 300 }))
    );
    s.outages.wasReportedDown.mockResolvedValue(
      Result.fail('db down')
    );

    await check(s).execute({ now: NOW });

    expect(s.publisher.publish).toHaveBeenCalledTimes(1);
  });

  it('[MON-174] should raise one health notice per router and check', async () => {
    const s = setup();
    s.reader.read.mockResolvedValue(
      Result.ok(makeReading({ temperatureC: 80, freeHddBytes: 10 }))
    );

    const result = await check(s).execute({ now: NOW });

    expect(result.value.healthRaised).toBe(2);
    expect(s.publisher.publish).toHaveBeenCalledTimes(1);
    expect(s.publisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'router_health',
        resolved: false,
        summary: '2 problemas de salud en "RB4011 Core"'
      })
    );
  });

  it('[MON-172] should judge against the saved thresholds', async () => {
    const s = setup();
    s.thresholds.get.mockResolvedValue(
      Result.ok(
        RouterHealthThresholds.create({
          ...RouterHealthThresholds.defaults().values,
          maxTemperatureC: 40
        }).value
      )
    );

    const result = await check(s).execute({ now: NOW });

    expect(result.value.healthRaised).toBe(1);
  });

  it('should fail when the thresholds cannot be read', async () => {
    const s = setup();
    s.thresholds.get.mockResolvedValue(Result.fail('db down'));

    const result = await check(s).execute({ now: NOW });

    expect(result.error).toBe('db down');
    expect(s.reader.read).not.toHaveBeenCalled();
  });
});

describe('Router health thresholds use cases', () => {
  const DEFAULTS = RouterHealthThresholds.defaults().values;

  it('[MON-172] should answer the saved thresholds beside the defaults', async () => {
    const s = setup();

    const result = await new GetRouterHealthThresholdsUseCase(
      s.thresholds,
      makeLogger()
    ).execute();

    expect(result.value).toEqual({
      thresholds: DEFAULTS,
      defaults: DEFAULTS
    });
  });

  it('[MON-172] should save valid thresholds', async () => {
    const s = setup();
    const wanted = { ...DEFAULTS, minVoltage: 22 };

    const result = await new UpdateRouterHealthThresholdsUseCase(
      s.thresholds,
      makeLogger()
    ).execute(wanted);

    expect(result.value.thresholds).toEqual(wanted);
    expect(s.thresholds.save.mock.calls[0]![0].values).toEqual(
      wanted
    );
  });

  it('[MON-172] should refuse a threshold out of range and save nothing', async () => {
    const s = setup();

    const result = await new UpdateRouterHealthThresholdsUseCase(
      s.thresholds,
      makeLogger()
    ).execute({ ...DEFAULTS, cpuPercent: 100 });

    expect(result.error).toBe(
      'cpuPercent must be a whole number from 50 to 99'
    );
    expect(s.thresholds.save).not.toHaveBeenCalled();
  });
});

describe('GetRouterAuditUseCase', () => {
  const audit = (s: ReturnType<typeof setup>) =>
    new GetRouterAuditUseCase(s.targets, s.recorder, makeLogger());

  it('[MON-186] should list each router with its findings, oldest RouterOS first, without reading any', async () => {
    const THIRD_ID = '8b3e4d5c-6f7a-4b2c-9d0e-1f2a3b4c5d6e';
    const s = setup(
      [
        makeCandidate(),
        makeCandidate({
          deviceId: OTHER_ID,
          deviceName: 'Torre Norte'
        }),
        makeCandidate({ deviceId: THIRD_ID, deviceName: 'Nuevo' })
      ],
      [
        makeState(ROUTER_ID, makeReading()),
        makeState(
          OTHER_ID,
          makeReading({
            routerOsVersion: '6.49.10',
            currentFirmware: '6.47',
            upgradeFirmware: '6.49.10',
            security: {
              services: [
                {
                  name: 'telnet',
                  port: 23,
                  enabled: true,
                  allowedAddresses: ['10.0.0.0/8']
                }
              ],
              userNames: ['admin'],
              discoveryInterfaceList: null
            }
          })
        )
      ]
    );

    const result = await audit(s).execute();

    expect(s.reader.read).not.toHaveBeenCalled();
    expect(result.value.routers.map((r) => r.name)).toEqual([
      'Torre Norte',
      'RB4011 Core',
      'Nuevo'
    ]);
    expect(result.value.routers[0]).toEqual({
      deviceId: OTHER_ID,
      name: 'Torre Norte',
      ipAddress: '10.0.0.1',
      readable: true,
      reason: null,
      readAt: EARLIER.toISOString(),
      lastError: null,
      routerOsVersion: '6.49.10',
      currentFirmware: '6.47',
      upgradeFirmware: '6.49.10',
      findings: [
        { code: 'FIRMWARE_BEHIND', service: null, port: null },
        { code: 'PLAINTEXT_SERVICE', service: 'telnet', port: 23 },
        { code: 'ADMIN_USER', service: null, port: null }
      ],
      unchecked: ['DISCOVERY']
    });
    expect(result.value.routers[1]).toMatchObject({
      findings: [],
      unchecked: ['SERVICES', 'USERS', 'DISCOVERY']
    });
    expect(result.value.routers[2]).toMatchObject({
      readAt: null,
      routerOsVersion: null,
      findings: [],
      unchecked: ['SERVICES', 'USERS', 'DISCOVERY']
    });
  });

  it('[MON-186] should say why a router cannot be read', async () => {
    const s = setup([makeCandidate({ login: null })]);

    const result = await audit(s).execute();

    expect(result.value.routers[0]).toMatchObject({
      readable: false,
      reason: expect.any(String)
    });
  });

  it('should pass a failed query on', async () => {
    const s = setup();
    s.repository.listForDevices.mockResolvedValue(
      Result.fail('db down')
    );

    const result = await audit(s).execute();

    expect(result.error).toBe('db down');
  });
});
