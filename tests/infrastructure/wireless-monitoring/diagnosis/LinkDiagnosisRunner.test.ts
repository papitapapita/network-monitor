import { LinkDiagnosisRunner } from '../../../../src/infrastructure/wireless-monitoring/diagnosis/LinkDiagnosisRunner';
import {
  IWirelessCollector,
  LinkDiagnosisTarget,
  TOO_MANY_DIAGNOSES,
  WirelessCollectionResult
} from '../../../../src/application/wireless-monitoring/interfaces';
import {
  IEventStreamHub,
  ILogger
} from '../../../../src/application/shared/interfaces';
import { IPingService } from '../../../../src/application/device-monitoring/interfaces';
import { WirelessAlertEvaluator } from '../../../../src/domain/wireless-monitoring/services/WirelessAlertEvaluator';
import { LinkDiagnosisAnalyzer } from '../../../../src/domain/wireless-monitoring/services/LinkDiagnosisAnalyzer';
import { Result } from '../../../../src/domain/shared/core/Result';

const DEVICE_A = '550e8400-e29b-41d4-a716-446655440001';
const DEVICE_B = '550e8400-e29b-41d4-a716-446655440002';
const CHANNEL_A = `diagnosis:device:${DEVICE_A}`;

function makeLogger(): jest.Mocked<ILogger> {
  const logger: jest.Mocked<ILogger> = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
    setLevel: jest.fn(),
    child: jest.fn()
  };
  logger.child.mockReturnValue(logger);
  return logger;
}

function makeHub(): jest.Mocked<IEventStreamHub> {
  return {
    subscribe: jest.fn(),
    publish: jest.fn(),
    clientCount: jest.fn().mockReturnValue(0),
    closeAll: jest.fn()
  };
}

function makeCollected(): WirelessCollectionResult {
  return {
    deviceName: 'CPE-Juan',
    firmwareVersion: null,
    uptimeSeconds: null,
    deviceTimeEpoch: null,
    cpuLoadPercent: null,
    memoryUsedPercent: null,
    essid: null,
    mode: null,
    frequencyMhz: null,
    channelWidthMhz: null,
    noiseFloorDbm: null,
    throughputTxBps: 1_000,
    throughputRxBps: 2_000,
    wirelessTxBytes: null,
    wirelessRxBytes: null,
    distanceM: null,
    clientsConnected: null,
    ccqPercent: null,
    signalRxDbm: -60,
    signalTxDbm: null,
    latencyMs: null,
    remoteApMac: null,
    remoteApName: null,
    remoteApIp: null,
    capacityTxKbps: null,
    capacityRxKbps: null,
    lanStatus: null,
    lanSpeedMbps: null,
    macAddress: null,
    deviceModel: null,
    clients: []
  };
}

function setup(config: { maxSessions?: number } = {}) {
  let now = new Date('2026-09-26T10:00:00.000Z').getTime();
  const clock = () => new Date(now);
  const hub = makeHub();
  const pingService = {
    ping: jest
      .fn()
      .mockResolvedValue(
        Result.ok({ isReachable: true, latencyMs: 4 })
      )
  };
  const collector = {
    method: 'http_api' as const,
    collect: jest.fn().mockResolvedValue(Result.ok(makeCollected()))
  };
  const logger = makeLogger();
  const runner = new LinkDiagnosisRunner(
    hub,
    pingService as unknown as IPingService,
    new WirelessAlertEvaluator([]),
    new LinkDiagnosisAnalyzer(),
    logger,
    { pingIntervalMs: 1000, radioIntervalMs: 2000, ...config },
    clock
  );

  const makeTarget = (
    overrides: Partial<LinkDiagnosisTarget> = {}
  ): LinkDiagnosisTarget => ({
    deviceId: DEVICE_A,
    deviceType: 'STATION',
    ipAddress: '10.0.0.20',
    parent: { deviceId: null, ipAddress: '10.0.0.1' },
    collector: collector as unknown as IWirelessCollector,
    credentials: {} as LinkDiagnosisTarget['credentials'],
    durationSeconds: 10,
    linkCapacityKbps: null,
    clientsProvisionedLimit: null,
    provisionedLanSpeedMbps: null,
    ...overrides
  });

  // advances both the fake timers and the clock the sessions read
  const advance = async (ms: number) => {
    now += ms;
    await jest.advanceTimersByTimeAsync(ms);
  };

  const events = (name: string) =>
    hub.publish.mock.calls.filter((c) => c[1] === name) as [
      string,
      string,
      Record<string, unknown>
    ][];

  return {
    runner,
    hub,
    pingService,
    collector,
    logger,
    makeTarget,
    advance,
    events
  };
}

describe('LinkDiagnosisRunner', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  describe('[WLS-180] start or join', () => {
    it('should start a session and probe immediately', async () => {
      const { runner, makeTarget, pingService, collector, advance } =
        setup();

      const result = runner.startOrJoin(makeTarget());
      await advance(0);

      expect(result.value.started).toBe(true);
      expect(result.value.diagnosis.status).toBe('RUNNING');
      expect(pingService.ping).toHaveBeenCalledWith(
        '10.0.0.20',
        1000
      );
      expect(pingService.ping).toHaveBeenCalledWith('10.0.0.1', 1000);
      expect(collector.collect).toHaveBeenCalledTimes(1);
      runner.stopAll();
    });

    it('should join rather than start a second session for the same device', async () => {
      const { runner, makeTarget, pingService, advance } = setup();

      runner.startOrJoin(makeTarget());
      const second = runner.startOrJoin(makeTarget());
      await advance(0);

      expect(second.value.started).toBe(false);
      expect(
        pingService.ping.mock.calls.filter(
          (c) => c[0] === '10.0.0.20'
        )
      ).toHaveLength(1);
      runner.stopAll();
    });
  });

  describe('[WLS-182] session cap', () => {
    it('should refuse a new device past the cap', () => {
      const { runner, makeTarget } = setup({ maxSessions: 1 });

      runner.startOrJoin(makeTarget());
      const refused = runner.startOrJoin(
        makeTarget({ deviceId: DEVICE_B })
      );

      expect(refused.error).toBe(TOO_MANY_DIAGNOSES);
      runner.stopAll();
    });

    it('should free the slot once a session ends', () => {
      const { runner, makeTarget } = setup({ maxSessions: 1 });

      runner.startOrJoin(makeTarget());
      runner.stop(DEVICE_A);

      expect(
        runner.startOrJoin(makeTarget({ deviceId: DEVICE_B }))
          .isSuccess
      ).toBe(true);
      runner.stopAll();
    });
  });

  describe('[WLS-183] sampling', () => {
    it('should ping each hop every second and read the radio every two', async () => {
      const { runner, makeTarget, events, advance } = setup();

      runner.startOrJoin(makeTarget());
      await advance(0);
      await advance(4000);

      const pings = events('ping').map((c) => c[2].hop);
      expect(pings.filter((h) => h === 'TARGET')).toHaveLength(5);
      expect(pings.filter((h) => h === 'PARENT')).toHaveLength(5);
      expect(events('radio')).toHaveLength(3);
      expect(events('report')).toHaveLength(3);
      expect(events('ping')[0]![0]).toBe(CHANNEL_A);
      runner.stopAll();
    });

    it('should skip a probe while the previous one is still in flight', async () => {
      const { runner, makeTarget, pingService, advance } = setup();
      pingService.ping.mockReturnValue(new Promise(() => undefined));

      runner.startOrJoin(makeTarget({ parent: null }));
      await advance(0);
      await advance(3000);

      expect(pingService.ping).toHaveBeenCalledTimes(1);
      runner.stopAll();
    });

    it('should record an unanswered ping as a loss', async () => {
      const { runner, makeTarget, pingService, events, advance } =
        setup();
      pingService.ping.mockResolvedValue(
        Result.ok({ isReachable: false, latencyMs: null })
      );

      runner.startOrJoin(makeTarget({ parent: null }));
      await advance(0);

      expect(events('ping')[0]![2]).toMatchObject({
        hop: 'TARGET',
        latencyMs: null
      });
      runner.stopAll();
    });

    it('should not count a failure of the ping tool as a loss', async () => {
      const {
        runner,
        makeTarget,
        pingService,
        events,
        logger,
        advance
      } = setup();
      pingService.ping.mockResolvedValue(Result.fail('spawn EACCES'));

      runner.startOrJoin(makeTarget({ parent: null }));
      await advance(0);

      expect(events('ping')).toHaveLength(0);
      expect(logger.warn).toHaveBeenCalled();
      expect(runner.find(DEVICE_A)!.report.target.sent).toBe(0);
      runner.stopAll();
    });

    it('should publish a failed radio read as a failed sample', async () => {
      const { runner, makeTarget, collector, events, advance } =
        setup();
      collector.collect.mockResolvedValue(Result.fail('HTTP 401'));

      runner.startOrJoin(makeTarget());
      await advance(0);

      expect(events('radio')[0]![2]).toMatchObject({
        ok: false,
        error: 'HTTP 401'
      });
      runner.stopAll();
    });
  });

  describe('[WLS-181] ending', () => {
    it('should complete on its own at the end of the duration', async () => {
      const { runner, makeTarget, pingService, events, advance } =
        setup();

      runner.startOrJoin(makeTarget({ durationSeconds: 10 }));
      await advance(10_000);
      const callsAtEnd = pingService.ping.mock.calls.length;
      await advance(5000);

      expect(events('end')).toHaveLength(1);
      expect(events('end')[0]![2].status).toBe('COMPLETED');
      expect(pingService.ping.mock.calls.length).toBe(callsAtEnd);
      expect(runner.find(DEVICE_A)!.status).toBe('COMPLETED');
    });

    it('should stop early on request and publish the end', () => {
      const { runner, makeTarget, events } = setup();

      runner.startOrJoin(makeTarget());
      const stopped = runner.stop(DEVICE_A);

      expect(stopped!.status).toBe('STOPPED');
      expect(events('end')).toHaveLength(1);
    });

    it('should return null when stopping a device with nothing running', () => {
      const { runner } = setup();

      expect(runner.stop(DEVICE_A)).toBeNull();
    });

    it('should keep a finished session readable for 15 minutes', async () => {
      const { runner, makeTarget, advance } = setup();

      runner.startOrJoin(makeTarget());
      runner.stop(DEVICE_A);
      await advance(15 * 60_000);
      expect(runner.find(DEVICE_A)).not.toBeNull();

      await advance(1000);
      expect(runner.find(DEVICE_A)).toBeNull();
    });

    it('should include samples when read back', async () => {
      const { runner, makeTarget, advance } = setup();

      runner.startOrJoin(makeTarget({ parent: null }));
      await advance(0);

      expect(runner.find(DEVICE_A)!.samples!.ping).toHaveLength(1);
      runner.stopAll();
    });

    it('should stop every session on shutdown', () => {
      const { runner, makeTarget, events } = setup();

      runner.startOrJoin(makeTarget());
      runner.startOrJoin(makeTarget({ deviceId: DEVICE_B }));
      runner.stopAll();

      expect(events('end')).toHaveLength(2);
      expect(jest.getTimerCount()).toBe(0);
    });
  });
});
