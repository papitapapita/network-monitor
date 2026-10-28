// Source: src/application/device-monitoring/use-cases/ListRouterSystemsUseCase.ts,
// GetRouterSystemUseCase.ts, CheckRouterSystemsUseCase.ts,
// services/RouterSystemRecorder.ts

import { ListRouterSystemsUseCase } from '../../../../src/application/device-monitoring/use-cases/ListRouterSystemsUseCase';
import { GetRouterSystemUseCase } from '../../../../src/application/device-monitoring/use-cases/GetRouterSystemUseCase';
import { CheckRouterSystemsUseCase } from '../../../../src/application/device-monitoring/use-cases/CheckRouterSystemsUseCase';
import { PORT_SPEED_ROUTER_NOT_FOUND } from '../../../../src/application/device-monitoring/use-cases/SetPortExpectedSpeedUseCase';
import { RouterSystemRecorder } from '../../../../src/application/device-monitoring/services/RouterSystemRecorder';
import {
  IPortSpeedTargetsQuery,
  IRouterSystemReader,
  PortSpeedRouterCandidate,
  RouterSystemReading
} from '../../../../src/application/device-monitoring/interfaces';
import { IRouterSystemStateRepository } from '../../../../src/domain/device-monitoring/repository';
import { RouterSystemState } from '../../../../src/domain/device-monitoring/aggregates';
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
  return { targets, reader, repository, recorder };
}

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

  it('should fail when the states cannot be saved', async () => {
    const { recorder, repository } = setup();
    repository.saveAll.mockResolvedValue(Result.fail('db down'));

    const result = await recorder.record([makeCandidate()], NOW);

    expect(result.error).toBe('db down');
  });
});

describe('ListRouterSystemsUseCase', () => {
  it('[MON-162] should list every router with its last reading, without reading any', async () => {
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
        system: makeReading(),
        readAt: EARLIER.toISOString(),
        attemptedAt: EARLIER.toISOString(),
        lastError: null
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
        lastError: null
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
      system: makeReading(),
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

    const result = await new CheckRouterSystemsUseCase(
      s.targets,
      s.recorder,
      makeLogger()
    ).execute({ now: NOW });

    expect(result.value).toEqual({
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

    const result = await new CheckRouterSystemsUseCase(
      s.targets,
      s.recorder,
      makeLogger()
    ).execute({ now: NOW });

    expect(result.value).toEqual({
      routersRead: 0,
      skipped: [],
      failed: []
    });
    expect(s.repository.listForDevices).not.toHaveBeenCalled();
  });
});
