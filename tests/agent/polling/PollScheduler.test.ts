import {
  ICycleProbe,
  PollScheduler
} from '../../../src/agent/polling/PollScheduler';
import {
  ConfigDeviceWire,
  PingResultWire
} from '../../../src/agent/protocol';
import type { PingCycleOutcome } from '../../../src/application/device-monitoring/services/PingCycleProbe';
import { silentLogger } from '../helpers';

const reachable: PingCycleOutcome = {
  kind: 'measured',
  isReachable: true,
  latencyMs: 3,
  attempts: 1
};

function device(
  d: number,
  overrides: Partial<ConfigDeviceWire> = {}
): ConfigDeviceWire {
  return {
    d,
    ip: `10.0.0.${d}`,
    intervalSeconds: 60,
    failuresBeforeDown: 3,
    ...overrides
  };
}

describe('PollScheduler', () => {
  let now: number;
  let results: PingResultWire[];
  let probe: jest.Mocked<ICycleProbe>;
  let ids: number;

  const make = (maxConcurrent = 32) =>
    new PollScheduler(probe, (r) => results.push(r), silentLogger(), {
      now: () => now,
      newId: () => `r${++ids}`,
      maxConcurrent
    });

  const run = async (scheduler: PollScheduler) => {
    scheduler.tick();
    await scheduler.drain();
  };

  beforeEach(() => {
    now = 1_000_000;
    results = [];
    ids = 0;
    probe = { run: jest.fn().mockResolvedValue(reachable) };
  });

  it('[AGT-061] polls a new device at once and reports one result per cycle', async () => {
    const scheduler = make();
    scheduler.applyConfig([device(1)]);

    await run(scheduler);

    expect(probe.run).toHaveBeenCalledWith('10.0.0.1', 3);
    expect(results).toEqual([
      {
        id: 'r1',
        d: 1,
        at: 1_000_000,
        reachable: true,
        latencyMs: 3,
        attempts: 1
      }
    ]);
  });

  it('[AGT-061] polls again only once the interval has passed', async () => {
    const scheduler = make();
    scheduler.applyConfig([device(1, { intervalSeconds: 60 })]);
    await run(scheduler);

    now += 59_000;
    await run(scheduler);
    expect(results).toHaveLength(1);

    now += 1_000;
    await run(scheduler);
    expect(results).toHaveLength(2);
    expect(results[1].at).toBe(1_060_000);
  });

  it('[AGT-061] a probe that could not run is reported as such', async () => {
    probe.run.mockResolvedValue({
      kind: 'probe-unavailable',
      error: 'spawn ping ENOENT',
      attempts: 3
    });
    const scheduler = make();
    scheduler.applyConfig([device(1)]);

    await run(scheduler);

    expect(results[0]).toEqual({
      id: 'r1',
      d: 1,
      at: 1_000_000,
      probeError: 'spawn ping ENOENT',
      attempts: 3
    });
  });

  it('[AGT-061] a probe that throws is reported as unable to run', async () => {
    probe.run.mockRejectedValue(new Error('boom'));
    const scheduler = make();
    scheduler.applyConfig([device(1)]);

    await run(scheduler);

    expect(results[0]).toMatchObject({ probeError: 'boom' });
  });

  it('never runs two cycles of the same device at once', async () => {
    let finish!: () => void;
    probe.run.mockReturnValue(
      new Promise((resolve) => (finish = () => resolve(reachable)))
    );
    const scheduler = make();
    scheduler.applyConfig([device(1, { intervalSeconds: 1 })]);

    scheduler.tick();
    now += 5_000;
    scheduler.tick();
    finish();
    await scheduler.drain();

    expect(probe.run).toHaveBeenCalledTimes(1);
  });

  it('starts no more cycles than the concurrency limit', async () => {
    probe.run.mockReturnValue(new Promise(() => {}));
    const scheduler = make(2);
    scheduler.applyConfig([device(1), device(2), device(3)]);

    scheduler.tick();

    expect(probe.run).toHaveBeenCalledTimes(2);
  });

  it('[AGT-062] a known device keeps its rhythm when the configuration is re-sent', async () => {
    const scheduler = make();
    scheduler.applyConfig([device(1)]);
    await run(scheduler);

    now += 10_000;
    scheduler.applyConfig([device(1)]);
    await run(scheduler);

    expect(results).toHaveLength(1);
  });

  it('[AGT-062] a shorter interval pulls the next poll forward', async () => {
    const scheduler = make();
    scheduler.applyConfig([device(1, { intervalSeconds: 300 })]);
    await run(scheduler);

    scheduler.applyConfig([device(1, { intervalSeconds: 30 })]);
    now += 30_000;
    await run(scheduler);

    expect(results).toHaveLength(2);
  });

  it('[AGT-062] a device no longer listed is not polled', async () => {
    const scheduler = make();
    scheduler.applyConfig([device(1), device(2)]);
    await run(scheduler);

    scheduler.applyConfig([device(2)]);
    now += 60_000;
    await run(scheduler);

    expect(results.map((r) => r.d)).toEqual([1, 2, 2]);
    expect(scheduler.deviceCount).toBe(1);
  });

  it('[AGT-063] pollAllNow measures every device regardless of its interval', async () => {
    const scheduler = make();
    scheduler.applyConfig([
      device(1, { intervalSeconds: 3600 }),
      device(2, { intervalSeconds: 3600 })
    ]);
    await run(scheduler);

    now += 5_000;
    scheduler.pollAllNow();
    await run(scheduler);

    expect(results).toHaveLength(4);
  });

  it('asks for at least one attempt', async () => {
    const scheduler = make();
    scheduler.applyConfig([device(1, { failuresBeforeDown: 0 })]);

    await run(scheduler);

    expect(probe.run).toHaveBeenCalledWith('10.0.0.1', 1);
  });
});
