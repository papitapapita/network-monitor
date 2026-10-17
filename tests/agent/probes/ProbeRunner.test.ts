import { Result } from '../../../src/domain/shared/core';
import {
  ProbeRunner,
  toWirelessReadingWire
} from '../../../src/agent/probes/ProbeRunner';
import {
  MAX_BACKUP_CONFIG_BYTES,
  MAX_SWEEP_TARGETS
} from '../../../src/agent/protocol';
import type {
  BackupConfigWire,
  BackupDeviceKindWire,
  BackupLoginWire,
  InterfaceTrafficWire,
  ProbeCredentialsWire,
  ProbeRequestMessage,
  WirelessReadingWire
} from '../../../src/agent/protocol';
import type {
  BackupCredentials,
  BackupDeviceKind,
  FetchedConfig,
  IConfigFetcher
} from '../../../src/application/device-backups/interfaces';
import {
  BackupFormat,
  MAX_CONFIG_BYTES
} from '../../../src/domain/device-backups';
import { ConfigFetcherRegistry } from '../../../src/infrastructure/device-backups/fetchers';
import type {
  DecryptedCredentials,
  IWirelessCollector,
  WirelessCollectionResult
} from '../../../src/application/wireless-monitoring/interfaces';
import { WirelessCollectorRegistry } from '../../../src/infrastructure/wireless-monitoring/collectors';
import type {
  InterfaceTrafficReading,
  IRouterTrafficReader
} from '../../../src/application/device-monitoring/interfaces';
import { silentLogger } from '../helpers';
import { makeWirelessCollectionResult } from '../../fixtures/wirelessCollection';

// The wire types are written out in the protocol, which may not import the
// backend's; these fail to compile the day the two drift apart.
type Wire<T> = {
  [K in keyof T]: T[K] extends bigint | null
    ? string | null
    : T[K] extends (infer U)[]
      ? U extends object
        ? Wire<U>[]
        : T[K]
      : T[K];
};
type Same<A, B> = [A] extends [B]
  ? [B] extends [A]
    ? true
    : false
  : false;
const credentialsMatch: Same<
  DecryptedCredentials,
  ProbeCredentialsWire
> = true;
const readingMatches: Same<
  Wire<WirelessCollectionResult>,
  WirelessReadingWire
> = true;
const loginMatches: Same<BackupCredentials, BackupLoginWire> = true;
const kindMatches: Same<BackupDeviceKind, BackupDeviceKindWire> =
  true;
const configMatches: Same<
  Wire<FetchedConfig>,
  Omit<BackupConfigWire, 'format'> & { format: BackupFormat }
> = true;
const trafficMatches: Same<
  InterfaceTrafficReading,
  InterfaceTrafficWire
> = true;
const formatsMatch: Same<
  `${BackupFormat}`,
  BackupConfigWire['format']
> = true;

const LOGIN: BackupLoginWire = {
  username: 'admin',
  password: 'router-secreto',
  httpPort: 443,
  sshPort: 2222
};

const backupRequest = (
  vendor = 'mikrotik',
  deviceKind: BackupDeviceKindWire = 'ROUTER'
): ProbeRequestMessage => ({
  type: 'probe',
  requestId: 'b-1',
  kind: 'backup',
  ip: '10.0.0.1',
  vendor,
  deviceKind,
  login: LOGIN
});

const trafficRequest = (): ProbeRequestMessage => ({
  type: 'probe',
  requestId: 't-1',
  kind: 'traffic',
  ip: '10.0.0.1',
  login: {
    username: 'api',
    password: 'router-secreto',
    apiPort: 8729
  }
});

const ETHER1: InterfaceTrafficReading = {
  name: 'ether1-wan',
  type: 'ether',
  running: true,
  rxBps: 120_000_000,
  txBps: 15_000_000
};

const CREDENTIALS: ProbeCredentialsWire = {
  snmpVersion: 2,
  snmpCommunity: 'public',
  snmpV3AuthUser: null,
  snmpV3AuthProto: null,
  snmpV3AuthKey: null,
  snmpV3PrivProto: null,
  snmpV3PrivKey: null,
  httpUsername: 'ubnt',
  httpPassword: 'secreto',
  snmpPort: 161,
  httpPort: 443
};

const pingRequest = (
  overrides: Partial<{ requestId: string; attempts: number }> = {}
): ProbeRequestMessage => ({
  type: 'probe',
  requestId: 'r-1',
  kind: 'ping',
  ip: '10.0.0.9',
  attempts: 3,
  ...overrides
});

const sweepRequest = (ips: string[]): ProbeRequestMessage => ({
  type: 'probe',
  requestId: 's-1',
  kind: 'sweep',
  ips,
  attempts: 3
});

const wirelessRequest = (
  vendor = 'ubiquiti'
): ProbeRequestMessage => ({
  type: 'probe',
  requestId: 'w-1',
  kind: 'wireless',
  ip: '10.0.0.10',
  vendor,
  deviceType: 'ACCESS_POINT',
  credentials: CREDENTIALS
});

describe('ProbeRunner', () => {
  let ping: { run: jest.Mock };
  let collector: jest.Mocked<IWirelessCollector>;
  let fetcher: jest.Mocked<IConfigFetcher>;
  let traffic: jest.Mocked<IRouterTrafficReader>;
  let logger: ReturnType<typeof silentLogger>;
  let runner: ProbeRunner;

  beforeEach(() => {
    ping = {
      run: jest.fn().mockResolvedValue({
        kind: 'measured',
        isReachable: true,
        latencyMs: 7,
        attempts: 1
      })
    };
    collector = {
      method: 'http_api',
      collect: jest
        .fn()
        .mockResolvedValue(Result.ok(makeWirelessCollectionResult()))
    };
    fetcher = {
      fetch: jest.fn().mockResolvedValue(
        Result.ok({
          format: BackupFormat.ROUTEROS_EXPORT,
          content: '/ip address\nadd address=10.0.0.1/24\n'
        })
      )
    };
    traffic = {
      read: jest.fn().mockResolvedValue(Result.ok([ETHER1])),
      releaseAll: jest.fn()
    };
    logger = silentLogger();
    runner = new ProbeRunner(
      ping,
      new WirelessCollectorRegistry({ ubiquiti: collector }),
      new ConfigFetcherRegistry([
        {
          vendor: 'mikrotik',
          kinds: ['ACCESS_POINT', 'ROUTER', 'SWITCH'],
          fetcher
        }
      ]),
      traffic,
      logger
    );
  });

  it('keeps the wire types in step with the collectors and fetchers', () => {
    expect([
      credentialsMatch,
      readingMatches,
      loginMatches,
      kindMatches,
      configMatches,
      formatsMatch,
      trafficMatches
    ]).toEqual([true, true, true, true, true, true, true]);
    expect(MAX_BACKUP_CONFIG_BYTES).toBe(MAX_CONFIG_BYTES);
  });

  it('[AGT-114] reads the configuration with the fetcher the backend would use', async () => {
    const before = Date.now();

    const result = await runner.run(backupRequest());

    expect(fetcher.fetch).toHaveBeenCalledWith('10.0.0.1', LOGIN);
    expect(result).toEqual({
      type: 'probe.result',
      requestId: 'b-1',
      kind: 'backup',
      at: expect.any(Number),
      config: {
        format: 'ROUTEROS_EXPORT',
        content: '/ip address\nadd address=10.0.0.1/24\n'
      }
    });
    expect((result as { at: number }).at).toBeGreaterThanOrEqual(
      before
    );
  });

  it('[AGT-114] answers an error when the device cannot be read', async () => {
    fetcher.fetch.mockResolvedValue(
      Result.fail(
        'SSH login rejected: check the device username and password'
      )
    );

    expect(await runner.run(backupRequest())).toEqual({
      type: 'probe.result',
      requestId: 'b-1',
      error:
        'SSH login rejected: check the device username and password'
    });
  });

  it('[AGT-114] answers an error for a kind of device its vendor has no fetcher for', async () => {
    expect(
      await runner.run(backupRequest('ubiquiti', 'ROUTER'))
    ).toEqual({
      type: 'probe.result',
      requestId: 'b-1',
      error:
        'Backups are not supported for this kind of device from this vendor yet'
    });
    expect(fetcher.fetch).not.toHaveBeenCalled();
  });

  it('[AGT-115] never logs the login it was given', async () => {
    await runner.run(backupRequest());

    const logged = JSON.stringify(
      Object.values(logger)
        .filter((fn) => jest.isMockFunction(fn))
        .flatMap((fn) => (fn as jest.Mock).mock.calls)
    );
    expect(logged).not.toContain('router-secreto');
  });

  it('[AGT-117] reads the router traffic on the API port it was given', async () => {
    const result = await runner.run(trafficRequest());

    expect(traffic.read).toHaveBeenCalledWith({
      host: '10.0.0.1',
      port: 8729,
      username: 'api',
      password: 'router-secreto',
      agentId: null
    });
    expect(result).toEqual({
      type: 'probe.result',
      requestId: 't-1',
      kind: 'traffic',
      at: expect.any(Number),
      interfaces: [ETHER1]
    });
  });

  it('[AGT-117] answers an error when the router cannot be read', async () => {
    traffic.read.mockResolvedValue(
      Result.fail('RouterOS API error: invalid user name or password')
    );

    expect(await runner.run(trafficRequest())).toEqual({
      type: 'probe.result',
      requestId: 't-1',
      error: 'RouterOS API error: invalid user name or password'
    });
  });

  it('[AGT-118] never logs the router login it was given', async () => {
    await runner.run(trafficRequest());

    const logged = JSON.stringify(
      Object.values(logger)
        .filter((fn) => jest.isMockFunction(fn))
        .flatMap((fn) => (fn as jest.Mock).mock.calls)
    );
    expect(logged).not.toContain('router-secreto');
  });

  it('[AGT-101] pings with the device attempt budget and answers with the reading', async () => {
    const before = Date.now();

    const result = await runner.run(pingRequest());

    expect(ping.run).toHaveBeenCalledWith('10.0.0.9', 3);
    expect(result).toEqual({
      type: 'probe.result',
      requestId: 'r-1',
      kind: 'ping',
      at: expect.any(Number),
      reading: { reachable: true, latencyMs: 7, attempts: 1 }
    });
    expect((result as { at: number }).at).toBeGreaterThanOrEqual(
      before
    );
  });

  it('[AGT-101] reports a ping that could not run apart from an unreachable device', async () => {
    ping.run.mockResolvedValue({
      kind: 'probe-unavailable',
      error: 'spawn ping ENOENT',
      attempts: 3
    });

    const result = await runner.run(pingRequest());

    expect(result).toMatchObject({
      kind: 'ping',
      reading: { probeError: 'spawn ping ENOENT', attempts: 3 }
    });
  });

  it.each([
    [0, 1],
    [50, 10],
    [2.7, 2]
  ])(
    '[AGT-101] keeps %p ping attempts within 1 to 10 (%p)',
    async (asked, used) => {
      await runner.run(pingRequest({ attempts: asked }));

      expect(ping.run).toHaveBeenCalledWith('10.0.0.9', used);
    }
  );

  it('[AGT-101] reads a radio with the collector for its vendor and the given credentials', async () => {
    const result = await runner.run(wirelessRequest('Ubiquiti'));

    expect(collector.collect).toHaveBeenCalledWith(
      '10.0.0.10',
      CREDENTIALS,
      'ACCESS_POINT'
    );
    expect(result).toMatchObject({
      type: 'probe.result',
      requestId: 'w-1',
      kind: 'wireless',
      reading: { deviceName: 'Torre Norte' }
    });
  });

  it('[AGT-101] sends the byte counters as decimal strings', () => {
    const wire = toWirelessReadingWire(
      makeWirelessCollectionResult()
    );

    expect(wire.wirelessTxBytes).toBe('12345678901234567890');
    expect(wire.wirelessRxBytes).toBeNull();
    expect(wire.clients[0].txBytesTotal).toBe('42');
    expect(wire.clients[0].rxBytesTotal).toBeNull();
    expect(() => JSON.stringify(wire)).not.toThrow();
  });

  it('[AGT-101] answers an error for a vendor it has no collector for', async () => {
    const result = await runner.run(wirelessRequest('cambium'));

    expect(result).toEqual({
      type: 'probe.result',
      requestId: 'w-1',
      error: "Wireless polling is not supported for vendor 'cambium'"
    });
  });

  it('[AGT-101] answers the collector error when the radio cannot be read', async () => {
    collector.collect.mockResolvedValue(Result.fail('Login failed'));

    const result = await runner.run(wirelessRequest());

    expect(result).toEqual({
      type: 'probe.result',
      requestId: 'w-1',
      error: 'Login failed'
    });
  });

  it('[AGT-101] answers an error instead of throwing when a probe crashes', async () => {
    ping.run.mockRejectedValue(new Error('boom'));

    const result = await runner.run(pingRequest());

    expect(result).toEqual({
      type: 'probe.result',
      requestId: 'r-1',
      error: 'boom'
    });
  });

  it('[AGT-101] answers an unknown kind with an error', async () => {
    const result = await runner.run({
      ...pingRequest(),
      kind: 'scan'
    } as unknown as ProbeRequestMessage);

    expect(result).toEqual({
      type: 'probe.result',
      requestId: 'r-1',
      error: 'Unknown probe kind'
    });
  });

  it('[AGT-101] runs at most maxConcurrent probes and answers busy past the queue', async () => {
    const releases: Array<() => void> = [];
    ping.run.mockImplementation(
      () =>
        new Promise((resolve) =>
          releases.push(() =>
            resolve({
              kind: 'measured',
              isReachable: true,
              latencyMs: 1,
              attempts: 1
            })
          )
        )
    );
    runner = new ProbeRunner(
      ping,
      new WirelessCollectorRegistry({}),
      new ConfigFetcherRegistry([]),
      traffic,
      logger,
      { maxConcurrent: 2, maxQueued: 1 }
    );

    const running = [1, 2, 3].map((n) =>
      runner.run(pingRequest({ requestId: `r-${n}` }))
    );
    const busy = await runner.run(pingRequest({ requestId: 'r-4' }));
    await new Promise((resolve) => setImmediate(resolve));

    expect(ping.run).toHaveBeenCalledTimes(2);
    expect(busy).toEqual({
      type: 'probe.result',
      requestId: 'r-4',
      error: 'The agent is busy with other probes'
    });

    releases.shift()!();
    await running[0];
    await new Promise((resolve) => setImmediate(resolve));
    expect(ping.run).toHaveBeenCalledTimes(3);
    releases.splice(0).forEach((release) => release());
    await Promise.all(running);
  });

  it('[AGT-102] never logs the credentials it was given', async () => {
    await runner.run(wirelessRequest());

    const logged = JSON.stringify(
      Object.values(logger)
        .filter((fn) => jest.isMockFunction(fn))
        .flatMap((fn) => (fn as jest.Mock).mock.calls)
    );
    expect(logged).not.toContain('secreto');
    expect(logged).not.toContain('public');
  });

  describe('sweep', () => {
    let sweepPing: { run: jest.Mock };

    beforeEach(() => {
      sweepPing = {
        run: jest.fn(async (ip: string) =>
          ip.endsWith('.2')
            ? {
                kind: 'measured',
                isReachable: false,
                latencyMs: null,
                attempts: 3
              }
            : {
                kind: 'measured',
                isReachable: true,
                latencyMs: 4,
                attempts: 1
              }
        )
      };
      runner = new ProbeRunner(
        ping,
        new WirelessCollectorRegistry({}),
        new ConfigFetcherRegistry([]),
        traffic,
        logger,
        { maxConcurrent: 4, maxQueued: 100 },
        sweepPing
      );
    });

    it('[AGT-119] pings every address with the quick ping and answers in the same order', async () => {
      const result = await runner.run(
        sweepRequest(['10.0.0.1', '10.0.0.2', '10.0.0.3'])
      );

      expect(ping.run).not.toHaveBeenCalled();
      expect(sweepPing.run.mock.calls).toEqual([
        ['10.0.0.1', 3],
        ['10.0.0.2', 3],
        ['10.0.0.3', 3]
      ]);
      expect(result).toEqual({
        type: 'probe.result',
        requestId: 's-1',
        kind: 'sweep',
        at: expect.any(Number),
        readings: [
          { reachable: true, latencyMs: 4, attempts: 1 },
          { reachable: false, latencyMs: null, attempts: 3 },
          { reachable: true, latencyMs: 4, attempts: 1 }
        ]
      });
    });

    it('[AGT-119] pings the whole batch at once, as one probe', async () => {
      let inFlight = 0;
      let peak = 0;
      sweepPing.run.mockImplementation(async () => {
        inFlight++;
        peak = Math.max(peak, inFlight);
        await new Promise((resolve) => setImmediate(resolve));
        inFlight--;
        return {
          kind: 'measured',
          isReachable: true,
          latencyMs: 1,
          attempts: 1
        };
      });
      const ips = Array.from(
        { length: MAX_SWEEP_TARGETS },
        (_, i) => `10.1.0.${i + 1}`
      );

      await runner.run(sweepRequest(ips));

      expect(peak).toBe(MAX_SWEEP_TARGETS);
    });

    it('[AGT-119] answers one address that cannot be pinged as a probe error, not the batch', async () => {
      sweepPing.run.mockImplementationOnce(async () => {
        throw new Error('spawn ping EAGAIN');
      });

      const result = await runner.run(
        sweepRequest(['10.0.0.1', '10.0.0.3'])
      );

      expect(result).toMatchObject({
        kind: 'sweep',
        readings: [
          { probeError: 'spawn ping EAGAIN', attempts: 1 },
          { reachable: true, latencyMs: 4, attempts: 1 }
        ]
      });
    });

    it('[AGT-119] refuses a batch larger than the protocol allows', async () => {
      const ips = Array.from(
        { length: MAX_SWEEP_TARGETS + 1 },
        (_, i) => `10.2.0.${i + 1}`
      );

      const result = await runner.run(sweepRequest(ips));

      expect(sweepPing.run).not.toHaveBeenCalled();
      expect(result).toEqual({
        type: 'probe.result',
        requestId: 's-1',
        error: `A sweep names at most ${MAX_SWEEP_TARGETS} addresses`
      });
    });

    it('[AGT-119] keeps the attempts within the ping limit', async () => {
      await runner.run({
        ...sweepRequest(['10.0.0.1']),
        attempts: 50
      } as ProbeRequestMessage);

      expect(sweepPing.run).toHaveBeenCalledWith('10.0.0.1', 10);
    });
  });
});
