import { promises as fs } from 'fs';
import path from 'path';
import { AgentRuntime } from '../../src/agent/AgentRuntime';
import { ConfigStore } from '../../src/agent/config/ConfigStore';
import { CredentialStore } from '../../src/agent/identity/CredentialStore';
import { PairingKeySource } from '../../src/agent/identity/PairingKeySource';
import { FilePermissionProtector } from '../../src/agent/identity/SecretProtector';
import { EnrollOutcome } from '../../src/agent/identity/enrollAgent';
import { PollScheduler } from '../../src/agent/polling/PollScheduler';
import { ResultBuffer } from '../../src/agent/results/ResultBuffer';
import {
  BackendConnection,
  ConnectionCallbacks
} from '../../src/agent/connection/BackendConnection';
import { ConfigMessage } from '../../src/agent/protocol';
import { silentLogger, tempDir } from './helpers';

const credentials = {
  backendUrl: 'https://api.example.com',
  token: 'tok',
  agentName: 'Torre'
};

const config: ConfigMessage = {
  type: 'config',
  version: 'v1',
  devices: [
    {
      d: 1,
      ip: '10.0.0.1',
      intervalSeconds: 60,
      failuresBeforeDown: 3
    }
  ]
};

describe('AgentRuntime', () => {
  let dir: string;
  let remove: () => void;
  let runtime: AgentRuntime;
  let buffer: ResultBuffer;
  let scheduler: PollScheduler;
  let store: CredentialStore;
  let configStore: ConfigStore;
  let enroll: jest.Mock<Promise<EnrollOutcome>, [string]>;
  let callbacks: ConnectionCallbacks | null;
  let connection: { start: jest.Mock; stop: jest.Mock };

  const build = async (pairingKey: string | null = null) => {
    buffer = await ResultBuffer.open(dir, silentLogger());
    scheduler = new PollScheduler(
      {
        run: jest.fn().mockResolvedValue({
          kind: 'measured',
          isReachable: true,
          latencyMs: 1,
          attempts: 1
        })
      },
      (r) => buffer.add(r),
      silentLogger()
    );
    runtime = new AgentRuntime({
      credentials: store,
      pairingKey: new PairingKeySource(dir, pairingKey),
      enroll,
      config: configStore,
      buffer,
      scheduler,
      connect: (_credentials, given) => {
        callbacks = given;
        return connection as unknown as BackendConnection;
      },
      logger: silentLogger(),
      pairingCheckMs: 20,
      enrollRetryMs: 20
    });
    return runtime;
  };

  const eventually = async (
    check: () => boolean | Promise<boolean>
  ) => {
    for (let i = 0; i < 100; i++) {
      if (await check()) return;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error('Timed out waiting');
  };

  beforeEach(() => {
    ({ dir, remove } = tempDir());
    store = new CredentialStore(dir, new FilePermissionProtector());
    configStore = new ConfigStore(dir);
    enroll = jest.fn();
    callbacks = null;
    connection = { start: jest.fn(), stop: jest.fn() };
  });

  afterEach(async () => {
    await runtime?.stop();
    remove();
  });

  it('[AGT-060] waits for a pairing key, enrolls once, then connects', async () => {
    enroll.mockResolvedValue({ kind: 'enrolled', credentials });
    await (await build()).start();
    expect(connection.start).not.toHaveBeenCalled();

    await fs.writeFile(path.join(dir, 'pairing.key'), 'pk1.a.b');

    await eventually(() => connection.start.mock.calls.length === 1);
    expect(enroll).toHaveBeenCalledWith('pk1.a.b');
    expect(await store.load()).toEqual(credentials);
    await expect(
      fs.stat(path.join(dir, 'pairing.key'))
    ).rejects.toThrow();
  });

  it('[AGT-060] a refused key is thrown away and never tried again', async () => {
    enroll.mockResolvedValue({ kind: 'rejected', reason: 'used' });
    await fs.writeFile(path.join(dir, 'pairing.key'), 'pk1.a.b');

    await (await build()).start();
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(enroll).toHaveBeenCalledTimes(1);
    await expect(
      fs.stat(path.join(dir, 'pairing.key'))
    ).rejects.toThrow();
    expect(connection.start).not.toHaveBeenCalled();
  });

  it('[AGT-060] a backend that cannot be reached is retried with the same key', async () => {
    enroll
      .mockResolvedValueOnce({
        kind: 'retry',
        reason: 'down',
        subscriptionExpired: false
      })
      .mockResolvedValueOnce({ kind: 'enrolled', credentials });

    await (await build('pk1.a.b')).start();

    await eventually(() => connection.start.mock.calls.length === 1);
    expect(enroll).toHaveBeenCalledTimes(2);
  });

  it('[AGT-062] an enrolled agent polls its saved configuration before the backend answers', async () => {
    await store.save(credentials);
    await configStore.save({
      version: 'v1',
      devices: config.devices
    });

    await (await build()).start();

    expect(scheduler.deviceCount).toBe(1);
    expect(scheduler.isRunning).toBe(true);
    expect(connection.start).toHaveBeenCalled();
    expect(enroll).not.toHaveBeenCalled();
  });

  it('[AGT-062] [AGT-063] a configuration is applied, saved, and polled at once when it is the first since connecting', async () => {
    await store.save(credentials);
    await (await build()).start();
    const pollAllNow = jest.spyOn(scheduler, 'pollAllNow');

    await callbacks!.onConfig(config, true);
    await callbacks!.onConfig({ ...config, version: 'v2' }, false);

    expect(scheduler.deviceCount).toBe(1);
    expect(pollAllNow).toHaveBeenCalledTimes(1);
    expect((await configStore.load())!.version).toBe('v2');
  });

  it('[AGT-065] stops measuring while the subscription is expired, and resumes on the next welcome', async () => {
    await store.save(credentials);
    await (await build()).start();

    callbacks!.onSubscriptionExpired();
    expect(scheduler.isRunning).toBe(false);

    callbacks!.onWelcome();
    expect(scheduler.isRunning).toBe(true);
  });

  it('[AGT-066] revocation removes the token, configuration and results, then waits to be paired again', async () => {
    await store.save(credentials);
    await configStore.save({
      version: 'v1',
      devices: config.devices
    });
    await (await build()).start();
    buffer.add({
      id: 'r1',
      d: 1,
      at: Date.now(),
      reachable: true,
      latencyMs: 1,
      attempts: 1
    });
    await buffer.persist();

    callbacks!.onRevoked();

    await eventually(async () => (await store.load()) === null);
    await eventually(async () => (await configStore.load()) === null);
    expect(buffer.size).toBe(0);
    expect(scheduler.deviceCount).toBe(0);
    expect(scheduler.isRunning).toBe(false);
    expect(await fs.readdir(path.join(dir, 'results'))).toEqual([]);
  });
});
