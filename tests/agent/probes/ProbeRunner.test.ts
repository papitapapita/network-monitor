import { Result } from '../../../src/domain/shared/core';
import {
  ProbeRunner,
  toWirelessReadingWire
} from '../../../src/agent/probes/ProbeRunner';
import { MAX_BACKUP_CONFIG_BYTES } from '../../../src/agent/protocol';
import type {
  BackupConfigWire,
  BackupDeviceKindWire,
  BackupLoginWire,
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
      formatsMatch
    ]).toEqual([true, true, true, true, true, true]);
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
});
