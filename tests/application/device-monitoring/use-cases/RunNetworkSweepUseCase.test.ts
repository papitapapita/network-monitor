// Source: src/application/device-monitoring/use-cases/RunNetworkSweepUseCase.ts

import {
  NETWORK_SWEEP_RUNNING,
  RunNetworkSweepUseCase
} from '../../../../src/application/device-monitoring/use-cases/RunNetworkSweepUseCase';
import {
  INetworkSweepTargetsQuery,
  NetworkSweepCandidate
} from '../../../../src/application/device-monitoring/interfaces/INetworkSweepTargetsQuery';
import {
  PingCycleOutcome,
  PingCycleProbe
} from '../../../../src/application/device-monitoring/services/PingCycleProbe';
import {
  NetworkSweepResultDTO,
  NetworkSweepStartDTO,
  RunNetworkSweepDTO
} from '../../../../src/application/device-monitoring/dtos/NetworkSweepDTO';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';
import { Result } from '../../../../src/domain/shared/core/Result';

function makeLogger(): ILogger {
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

let seq = 0;
function makeCandidate(
  overrides: Partial<NetworkSweepCandidate> = {}
): NetworkSweepCandidate {
  seq++;
  return {
    deviceId: `00000000-0000-4000-8000-${String(seq).padStart(12, '0')}`,
    deviceName: `Device ${seq}`,
    ipAddress: `10.0.0.${seq}`,
    category: 'CPE',
    locationId: null,
    locationName: null,
    agentId: null,
    monitored: true,
    ...overrides
  };
}

const up = (latencyMs = 5, attempts = 1): PingCycleOutcome => ({
  kind: 'measured',
  isReachable: true,
  latencyMs,
  attempts
});
const down = (attempts = 3): PingCycleOutcome => ({
  kind: 'measured',
  isReachable: false,
  latencyMs: null,
  attempts
});

interface Recorded {
  starts: NetworkSweepStartDTO[];
  results: NetworkSweepResultDTO[];
}

function makeRequest(overrides: Partial<RunNetworkSweepDTO> = {}): {
  request: RunNetworkSweepDTO;
  recorded: Recorded;
} {
  const recorded: Recorded = { starts: [], results: [] };
  return {
    recorded,
    request: {
      filters: {},
      onStart: (start) => recorded.starts.push(start),
      onResult: (result) => recorded.results.push(result),
      ...overrides
    }
  };
}

describe('RunNetworkSweepUseCase', () => {
  let targets: jest.Mocked<INetworkSweepTargetsQuery>;
  let probe: { run: jest.Mock };

  const makeUseCase = (
    serverOnSite = true,
    options = { concurrency: 64, attempts: 3 }
  ) =>
    new RunNetworkSweepUseCase(
      targets,
      probe as unknown as PingCycleProbe,
      makeLogger(),
      serverOnSite,
      options
    );

  beforeEach(() => {
    targets = { listInService: jest.fn() };
    probe = { run: jest.fn().mockResolvedValue(up()) };
  });

  describe('reporting', () => {
    it('announces the count, then one result per device, then the totals', async () => {
      const alive = makeCandidate({ ipAddress: '10.0.0.10' });
      const dead = makeCandidate({ ipAddress: '10.0.0.11' });
      targets.listInService.mockResolvedValue(
        Result.ok([alive, dead])
      );
      probe.run.mockImplementation(async (ip: string) =>
        ip === '10.0.0.10' ? up(12) : down()
      );
      const { request, recorded } = makeRequest();

      const result = await makeUseCase().execute(request);

      expect(recorded.starts).toEqual([
        expect.objectContaining({ total: 2, toPing: 2, filters: {} })
      ]);
      expect(recorded.results).toHaveLength(2);
      expect(
        recorded.results.find((r) => r.deviceId === alive.deviceId)
      ).toMatchObject({
        outcome: 'UP',
        latencyMs: 12,
        attempts: 1,
        reason: null,
        detail: null
      });
      expect(
        recorded.results.find((r) => r.deviceId === dead.deviceId)
      ).toMatchObject({
        outcome: 'DOWN',
        latencyMs: null,
        attempts: 3
      });
      expect(result.value).toMatchObject({
        total: 2,
        up: 1,
        down: 1,
        error: 0,
        skipped: 0,
        cancelled: false
      });
    });

    it('carries the device details on every result', async () => {
      const candidate = makeCandidate({
        deviceName: 'Tower AP',
        ipAddress: '10.9.9.9',
        category: 'ACCESS_POINT',
        locationId: 'loc-1',
        locationName: 'North tower'
      });
      targets.listInService.mockResolvedValue(Result.ok([candidate]));
      const { request, recorded } = makeRequest();

      await makeUseCase().execute(request);

      expect(recorded.results[0]).toMatchObject({
        deviceId: candidate.deviceId,
        deviceName: 'Tower AP',
        ipAddress: '10.9.9.9',
        category: 'ACCESS_POINT',
        locationId: 'loc-1',
        locationName: 'North tower'
      });
    });

    it('passes the filters to the query and echoes them in the start frame', async () => {
      targets.listInService.mockResolvedValue(Result.ok([]));
      const filters = { locationId: 'loc-1', category: 'GATEWAY' };
      const { request, recorded } = makeRequest({ filters });

      await makeUseCase().execute(request);

      expect(targets.listInService).toHaveBeenCalledWith(filters);
      expect(recorded.starts[0].filters).toEqual(filters);
    });

    it('finishes with zero totals when nothing matches', async () => {
      targets.listInService.mockResolvedValue(Result.ok([]));
      const { request, recorded } = makeRequest();

      const result = await makeUseCase().execute(request);

      expect(recorded.starts[0]).toMatchObject({
        total: 0,
        toPing: 0
      });
      expect(result.value).toMatchObject({
        total: 0,
        up: 0,
        down: 0
      });
      expect(probe.run).not.toHaveBeenCalled();
    });

    it('fails without starting when the devices cannot be loaded', async () => {
      targets.listInService.mockResolvedValue(Result.fail('db down'));
      const { request, recorded } = makeRequest();

      const result = await makeUseCase().execute(request);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('db down');
      expect(recorded.starts).toHaveLength(0);
    });
  });

  // MON-081
  describe('skipped devices', () => {
    it.each([
      [
        'monitoring is off',
        { monitored: false },
        'MONITORING_DISABLED'
      ],
      [
        'it sits behind an agent',
        { agentId: 'agent-1' },
        'BEHIND_AGENT'
      ],
      ['it has no IP address', { ipAddress: null }, 'NO_IP_ADDRESS']
    ])(
      'reports a device as skipped, without pinging it, when %s',
      async (_label, overrides, reason) => {
        targets.listInService.mockResolvedValue(
          Result.ok([makeCandidate(overrides)])
        );
        const { request, recorded } = makeRequest();

        const result = await makeUseCase().execute(request);

        expect(probe.run).not.toHaveBeenCalled();
        expect(recorded.starts[0]).toMatchObject({
          total: 1,
          toPing: 0
        });
        expect(recorded.results[0]).toMatchObject({
          outcome: 'SKIPPED',
          reason,
          detail: expect.any(String),
          attempts: 0
        });
        expect(result.value.skipped).toBe(1);
      }
    );

    it('pings nothing without an agent when the server is off site (MON-023)', async () => {
      targets.listInService.mockResolvedValue(
        Result.ok([makeCandidate()])
      );
      const { request, recorded } = makeRequest();

      await makeUseCase(false).execute(request);

      expect(probe.run).not.toHaveBeenCalled();
      expect(recorded.results[0].reason).toBe(
        'NOT_ON_MONITORED_NETWORK'
      );
    });

    it('names monitoring off before the agent', async () => {
      targets.listInService.mockResolvedValue(
        Result.ok([
          makeCandidate({ monitored: false, agentId: 'a-1' })
        ])
      );
      const { request, recorded } = makeRequest();

      await makeUseCase().execute(request);

      expect(recorded.results[0].reason).toBe('MONITORING_DISABLED');
    });
  });

  // MON-082
  describe('pinging', () => {
    it('makes the configured number of attempts', async () => {
      targets.listInService.mockResolvedValue(
        Result.ok([makeCandidate({ ipAddress: '10.1.1.1' })])
      );
      const { request } = makeRequest();

      await makeUseCase(true, {
        concurrency: 4,
        attempts: 3
      }).execute(request);

      expect(probe.run).toHaveBeenCalledWith('10.1.1.1', 3);
    });

    it('pings the backbone first: gateways, then switches, then access points', async () => {
      targets.listInService.mockResolvedValue(
        Result.ok([
          makeCandidate({
            deviceName: 'a-cpe',
            ipAddress: '10.0.1.1'
          }),
          makeCandidate({
            deviceName: 'b-ap',
            category: 'ACCESS_POINT',
            ipAddress: '10.0.1.2'
          }),
          makeCandidate({
            deviceName: 'c-switch',
            category: 'AGGREGATION_SWITCH',
            ipAddress: '10.0.1.3'
          }),
          makeCandidate({
            deviceName: 'd-gateway',
            category: 'GATEWAY',
            ipAddress: '10.0.1.4'
          })
        ])
      );
      const { request } = makeRequest();

      await makeUseCase(true, {
        concurrency: 1,
        attempts: 3
      }).execute(request);

      expect(probe.run.mock.calls.map(([ip]) => ip)).toEqual([
        '10.0.1.4',
        '10.0.1.3',
        '10.0.1.2',
        '10.0.1.1'
      ]);
    });

    it('never has more pings out than the concurrency allows', async () => {
      targets.listInService.mockResolvedValue(
        Result.ok(Array.from({ length: 10 }, () => makeCandidate()))
      );
      let inFlight = 0;
      let peak = 0;
      probe.run.mockImplementation(async () => {
        inFlight++;
        peak = Math.max(peak, inFlight);
        await new Promise((resolve) => setImmediate(resolve));
        inFlight--;
        return up();
      });
      const { request, recorded } = makeRequest();

      await makeUseCase(true, {
        concurrency: 3,
        attempts: 3
      }).execute(request);

      expect(peak).toBe(3);
      expect(recorded.results).toHaveLength(10);
    });

    it('reports a ping that could not run as an error, not as down', async () => {
      targets.listInService.mockResolvedValue(
        Result.ok([makeCandidate()])
      );
      probe.run.mockResolvedValue({
        kind: 'probe-unavailable',
        error: 'spawn ping ENOENT',
        attempts: 3
      });
      const { request, recorded } = makeRequest();

      const result = await makeUseCase().execute(request);

      expect(recorded.results[0]).toMatchObject({
        outcome: 'ERROR',
        detail: 'Ping could not run: spawn ping ENOENT'
      });
      expect(result.value).toMatchObject({ error: 1, down: 0 });
    });

    it('keeps sweeping the rest when one probe throws', async () => {
      targets.listInService.mockResolvedValue(
        Result.ok([
          makeCandidate({ ipAddress: '10.2.0.1' }),
          makeCandidate({ ipAddress: '10.2.0.2' })
        ])
      );
      probe.run.mockImplementation(async (ip: string) => {
        if (ip === '10.2.0.1') throw new Error('boom');
        return up();
      });
      const { request } = makeRequest();

      const result = await makeUseCase().execute(request);

      expect(result.value).toMatchObject({ up: 1, error: 1 });
    });
  });

  // MON-083
  describe('one sweep at a time', () => {
    it('refuses a second sweep while one is running', async () => {
      targets.listInService.mockResolvedValue(
        Result.ok([makeCandidate()])
      );
      let release!: () => void;
      probe.run.mockImplementation(
        () =>
          new Promise<PingCycleOutcome>((resolve) => {
            release = () => resolve(up());
          })
      );
      const useCase = makeUseCase();

      const first = useCase.execute(makeRequest().request);
      await new Promise((resolve) => setImmediate(resolve));
      const second = await useCase.execute(makeRequest().request);

      expect(second.isFailure).toBe(true);
      expect(second.error).toBe(NETWORK_SWEEP_RUNNING);

      release();
      expect((await first).isSuccess).toBe(true);
    });

    it('allows a new sweep once the last one finished, even if it failed', async () => {
      targets.listInService
        .mockResolvedValueOnce(Result.fail('db down'))
        .mockResolvedValueOnce(Result.ok([]));
      const useCase = makeUseCase();

      await useCase.execute(makeRequest().request);
      const again = await useCase.execute(makeRequest().request);

      expect(again.isSuccess).toBe(true);
    });

    it('starts no new ping once cancelled and reports no late results', async () => {
      targets.listInService.mockResolvedValue(
        Result.ok(Array.from({ length: 5 }, () => makeCandidate()))
      );
      const abort = new AbortController();
      probe.run.mockImplementation(async () => {
        abort.abort();
        return up();
      });
      const { request, recorded } = makeRequest({
        signal: abort.signal
      });

      const result = await makeUseCase(true, {
        concurrency: 1,
        attempts: 3
      }).execute(request);

      expect(probe.run).toHaveBeenCalledTimes(1);
      expect(recorded.results).toHaveLength(0);
      expect(result.value.cancelled).toBe(true);
    });
  });
});
