// Source: src/application/device-monitoring/use-cases/RunNetworkSweepUseCase.ts

import {
  DEFAULT_NETWORK_SWEEP_OPTIONS,
  NETWORK_SWEEP_RUNNING,
  NetworkSweepOptions,
  RunNetworkSweepUseCase
} from '../../../../src/application/device-monitoring/use-cases/RunNetworkSweepUseCase';
import {
  INetworkSweepTargetsQuery,
  NetworkSweepCandidate
} from '../../../../src/application/device-monitoring/interfaces/INetworkSweepTargetsQuery';
import {
  AgentSweepAnswer,
  IAgentSweepProbe
} from '../../../../src/application/device-monitoring/interfaces/IAgentSweepProbe';
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
    agentName: null,
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
  let agentProbe: jest.Mocked<IAgentSweepProbe>;

  const makeUseCase = (
    serverOnSite = true,
    options: Partial<NetworkSweepOptions> = {}
  ) =>
    new RunNetworkSweepUseCase(
      targets,
      probe as unknown as PingCycleProbe,
      agentProbe,
      makeLogger(),
      serverOnSite,
      { ...DEFAULT_NETWORK_SWEEP_OPTIONS, ...options }
    );

  beforeEach(() => {
    targets = { listInService: jest.fn() };
    probe = { run: jest.fn().mockResolvedValue(up()) };
    agentProbe = {
      sweep: jest.fn(
        async (
          _agentId: string,
          ips: string[],
          _attempts: number
        ): Promise<AgentSweepAnswer> => ({
          kind: 'measured',
          outcomes: ips.map(() => up())
        })
      )
    };
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
        expect(agentProbe.sweep).not.toHaveBeenCalled();
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

    it('skips a device behind an agent when monitoring is off or it has no address', async () => {
      targets.listInService.mockResolvedValue(
        Result.ok([
          makeCandidate({ monitored: false, agentId: 'a-1' }),
          makeCandidate({ ipAddress: null, agentId: 'a-1' })
        ])
      );
      const { request, recorded } = makeRequest();

      await makeUseCase().execute(request);

      expect(agentProbe.sweep).not.toHaveBeenCalled();
      expect(recorded.results.map((r) => r.reason)).toEqual([
        'MONITORING_DISABLED',
        'NO_IP_ADDRESS'
      ]);
    });
  });

  // MON-084
  describe('devices behind an agent', () => {
    it('asks their agent to ping them, not this server', async () => {
      const remote = makeCandidate({
        ipAddress: '192.168.5.1',
        agentId: 'a-1',
        agentName: 'Torre Norte'
      });
      targets.listInService.mockResolvedValue(Result.ok([remote]));
      agentProbe.sweep.mockResolvedValue({
        kind: 'measured',
        outcomes: [up(9, 1)]
      });
      const { request, recorded } = makeRequest();

      const result = await makeUseCase().execute(request);

      expect(probe.run).not.toHaveBeenCalled();
      expect(agentProbe.sweep).toHaveBeenCalledWith(
        'a-1',
        ['192.168.5.1'],
        3
      );
      expect(recorded.starts[0].toPing).toBe(1);
      expect(recorded.results[0]).toMatchObject({
        deviceId: remote.deviceId,
        agentName: 'Torre Norte',
        outcome: 'UP',
        latencyMs: 9,
        attempts: 1
      });
      expect(result.value.up).toBe(1);
    });

    it('sweeps them even when this server is off site (MON-023)', async () => {
      targets.listInService.mockResolvedValue(
        Result.ok([
          makeCandidate({ agentId: 'a-1' }),
          makeCandidate()
        ])
      );
      const { request, recorded } = makeRequest();

      await makeUseCase(false).execute(request);

      expect(agentProbe.sweep).toHaveBeenCalledTimes(1);
      expect(recorded.results.map((r) => r.outcome).sort()).toEqual([
        'SKIPPED',
        'UP'
      ]);
    });

    it('matches each answer to its device by position', async () => {
      const first = makeCandidate({
        ipAddress: '10.3.0.1',
        agentId: 'a-1'
      });
      const second = makeCandidate({
        ipAddress: '10.3.0.2',
        agentId: 'a-1'
      });
      targets.listInService.mockResolvedValue(
        Result.ok([first, second])
      );
      agentProbe.sweep.mockResolvedValue({
        kind: 'measured',
        outcomes: [down(), up(4)]
      });
      const { request, recorded } = makeRequest();

      await makeUseCase().execute(request);

      const outcomes = Object.fromEntries(
        recorded.results.map((r) => [r.deviceId, r.outcome])
      );
      expect(outcomes).toEqual({
        [first.deviceId]: 'DOWN',
        [second.deviceId]: 'UP'
      });
    });

    it('sends each agent its own devices in batches, backbone first', async () => {
      const gateway = makeCandidate({
        deviceName: 'z-gateway',
        category: 'GATEWAY',
        ipAddress: '10.4.0.9',
        agentId: 'a-1'
      });
      const cpes = [1, 2, 3].map((n) =>
        makeCandidate({
          deviceName: `cpe-${n}`,
          ipAddress: `10.4.0.${n}`,
          agentId: 'a-1'
        })
      );
      const other = makeCandidate({
        deviceName: 'cpe-4',
        ipAddress: '10.5.0.1',
        agentId: 'a-2'
      });
      targets.listInService.mockResolvedValue(
        Result.ok([...cpes, other, gateway])
      );
      const { request, recorded } = makeRequest();

      await makeUseCase(true, {
        agentBatchSize: 2,
        agentBatchesInFlight: 1
      }).execute(request);

      expect(agentProbe.sweep.mock.calls).toEqual([
        ['a-1', ['10.4.0.9', '10.4.0.1'], 3],
        ['a-2', ['10.5.0.1'], 3],
        ['a-1', ['10.4.0.2', '10.4.0.3'], 3]
      ]);
      expect(recorded.results).toHaveLength(5);
    });

    it('never has more batches out per agent than allowed', async () => {
      targets.listInService.mockResolvedValue(
        Result.ok(
          Array.from({ length: 10 }, () =>
            makeCandidate({ agentId: 'a-1' })
          )
        )
      );
      let inFlight = 0;
      let peak = 0;
      agentProbe.sweep.mockImplementation(async (_agentId, ips) => {
        inFlight++;
        peak = Math.max(peak, inFlight);
        await new Promise((resolve) => setImmediate(resolve));
        inFlight--;
        return { kind: 'measured', outcomes: ips.map(() => up()) };
      });
      const { request, recorded } = makeRequest();

      await makeUseCase(true, {
        agentBatchSize: 2,
        agentBatchesInFlight: 2
      }).execute(request);

      expect(peak).toBe(2);
      expect(agentProbe.sweep).toHaveBeenCalledTimes(5);
      expect(recorded.results).toHaveLength(10);
    });

    it.each([
      ['AGENT_OFFLINE', 'The agent is not connected'],
      [
        'PROBE_UNSUPPORTED',
        'The agent must be updated to sweep the network'
      ],
      ['TIMEOUT', 'The agent did not answer in time']
    ] as const)(
      'reports every device of a refused batch as an error (%s)',
      async (reason, error) => {
        targets.listInService.mockResolvedValue(
          Result.ok([
            makeCandidate({ agentId: 'a-1' }),
            makeCandidate({ agentId: 'a-1' })
          ])
        );
        agentProbe.sweep.mockResolvedValue({
          kind: 'refused',
          reason,
          error
        });
        const { request, recorded } = makeRequest();

        const result = await makeUseCase().execute(request);

        expect(recorded.results).toEqual([
          expect.objectContaining({
            outcome: 'ERROR',
            detail: error
          }),
          expect.objectContaining({ outcome: 'ERROR', detail: error })
        ]);
        expect(result.value).toMatchObject({ error: 2, down: 0 });
      }
    );

    it('keeps sweeping when asking an agent throws', async () => {
      targets.listInService.mockResolvedValue(
        Result.ok([
          makeCandidate({ agentId: 'a-1' }),
          makeCandidate()
        ])
      );
      agentProbe.sweep.mockRejectedValue(new Error('socket gone'));
      const { request, recorded } = makeRequest();

      const result = await makeUseCase().execute(request);

      expect(result.value).toMatchObject({ up: 1, error: 1 });
      expect(
        recorded.results.find((r) => r.outcome === 'ERROR')?.detail
      ).toBe('socket gone');
    });

    it('sends no new batch once cancelled and reports no late results', async () => {
      targets.listInService.mockResolvedValue(
        Result.ok(
          Array.from({ length: 4 }, () =>
            makeCandidate({ agentId: 'a-1' })
          )
        )
      );
      const abort = new AbortController();
      agentProbe.sweep.mockImplementation(async (_agentId, ips) => {
        abort.abort();
        return { kind: 'measured', outcomes: ips.map(() => up()) };
      });
      const { request, recorded } = makeRequest({
        signal: abort.signal
      });

      const result = await makeUseCase(true, {
        agentBatchSize: 1,
        agentBatchesInFlight: 1
      }).execute(request);

      expect(agentProbe.sweep).toHaveBeenCalledTimes(1);
      expect(recorded.results).toHaveLength(0);
      expect(result.value.cancelled).toBe(true);
    });
  });

  // MON-082
  describe('pinging', () => {
    it('makes the configured number of attempts', async () => {
      targets.listInService.mockResolvedValue(
        Result.ok([makeCandidate({ ipAddress: '10.1.1.1' })])
      );
      const { request } = makeRequest();

      await makeUseCase(true, { concurrency: 4 }).execute(request);

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

      await makeUseCase(true, { concurrency: 1 }).execute(request);

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

      await makeUseCase(true, { concurrency: 3 }).execute(request);

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
        concurrency: 1
      }).execute(request);

      expect(probe.run).toHaveBeenCalledTimes(1);
      expect(recorded.results).toHaveLength(0);
      expect(result.value.cancelled).toBe(true);
    });
  });
});
