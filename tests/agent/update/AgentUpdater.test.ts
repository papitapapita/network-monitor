import { createHash, generateKeyPairSync, sign } from 'crypto';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { gzipSync } from 'zlib';
import {
  AgentUpdater,
  AgentUpdaterDeps
} from '../../../src/agent/update/AgentUpdater';
import {
  UpdateState,
  UpdateStateStore
} from '../../../src/agent/update/UpdateStateStore';
import {
  UpdateMessage,
  releaseSignaturePayload
} from '../../../src/agent/protocol';
import { silentLogger, tempDir } from '../helpers';

const { privateKey, publicKey } = generateKeyPairSync('ed25519');
const PUBLIC_KEY = publicKey
  .export({ type: 'spki', format: 'pem' })
  .toString();

const OLD = Buffer.from('binary 0.2.0');
const NEW = Buffer.from('binary 0.2.1, a little longer');

const credentials = {
  backendUrl: 'https://api.example.com',
  token: 'tok-1',
  agentName: 'Torre'
};

function offerFor(
  binary: Buffer,
  overrides: Partial<UpdateMessage> = {}
): UpdateMessage {
  const version = overrides.version ?? '0.2.1';
  const sha256 = createHash('sha256').update(binary).digest('hex');
  return {
    type: 'update',
    version,
    file: `nms-agent-${version}-linux-x64.gz`,
    sha256,
    bytes: binary.length,
    signature: sign(
      null,
      Buffer.from(
        releaseSignaturePayload(version, 'linux-x64', sha256)
      ),
      privateKey
    ).toString('base64'),
    ...overrides
  };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('AgentUpdater', () => {
  let dir: string;
  let remove: () => void;
  let executable: string;
  let store: UpdateStateStore;
  let fetchFn: jest.Mock;
  let selfTest: jest.Mock;
  let restart: jest.Mock;

  const updater = (overrides: Partial<AgentUpdaterDeps> = {}) =>
    new AgentUpdater({
      store,
      executable,
      platform: 'linux-x64',
      version: '0.2.0',
      logger: silentLogger(),
      selfTest,
      restart,
      fetchFn,
      publicKeyPem: PUBLIC_KEY,
      retryMs: 10,
      ...overrides
    });

  const serve = (body: Buffer, status = 200) =>
    fetchFn.mockImplementation(
      async () => new Response(new Uint8Array(body), { status })
    );

  const contents = (file: string) =>
    existsSync(file) ? readFileSync(file).toString() : null;

  const state = (): Promise<UpdateState> => store.load();

  beforeEach(() => {
    ({ dir, remove } = tempDir());
    executable = path.join(dir, 'nms-agent');
    writeFileSync(executable, OLD);
    store = new UpdateStateStore(dir);
    fetchFn = jest.fn();
    serve(gzipSync(NEW));
    selfTest = jest.fn().mockResolvedValue('0.2.1');
    restart = jest.fn();
  });

  afterEach(() => remove());

  describe('installing an offer', () => {
    it('[AGT-081] downloads with its token, swaps the checked binary in and restarts', async () => {
      const agent = updater();
      await agent.recover();

      await agent.offer(offerFor(NEW), credentials);

      expect(fetchFn).toHaveBeenCalledWith(
        'https://api.example.com/agent/v1/updates/nms-agent-0.2.1-linux-x64.gz',
        expect.objectContaining({
          headers: { Authorization: 'Bearer tok-1' }
        })
      );
      expect(selfTest).toHaveBeenCalledWith(`${executable}.new`);
      expect(contents(executable)).toBe(NEW.toString());
      expect(contents(`${executable}.old`)).toBe(OLD.toString());
      expect(existsSync(`${executable}.new`)).toBe(false);
      expect(restart).toHaveBeenCalledTimes(1);
      expect((await state()).trial).toEqual({
        version: '0.2.1',
        previousVersion: '0.2.0',
        starts: 0
      });
    });

    it.each([
      [
        'a signature from another key',
        () => ({
          ...offerFor(NEW),
          signature: offerFor(NEW, { version: '0.2.2' }).signature
        }),
        'the signature does not verify'
      ],
      [
        'the other platform’s binary',
        () => offerFor(NEW, { file: 'nms-agent-0.2.1-win-x64.gz' }),
        'nms-agent-0.2.1-win-x64.gz is not the linux-x64 binary'
      ]
    ])(
      '[AGT-081] refuses %s without downloading it',
      async (_case, offer, reason) => {
        const agent = updater();
        await agent.recover();

        await agent.offer(offer(), credentials);

        expect(fetchFn).not.toHaveBeenCalled();
        expect(contents(executable)).toBe(OLD.toString());
        expect(restart).not.toHaveBeenCalled();
        expect(await state()).toEqual({
          trial: null,
          report: {
            type: 'update.result',
            version: '0.2.1',
            outcome: 'rejected',
            reason
          },
          failed: ['0.2.1']
        });
      }
    );

    it.each([
      [
        'does not match its SHA-256',
        () =>
          serve(
            gzipSync(Buffer.from('binary 0.2.1, a little LONGER'))
          ),
        'the binary does not match its SHA-256'
      ],
      [
        'is larger than announced',
        () => serve(gzipSync(Buffer.concat([NEW, NEW]))),
        `the binary is larger than the ${NEW.length} bytes announced`
      ],
      [
        'is smaller than announced',
        () => serve(gzipSync(NEW.subarray(1))),
        `the binary is ${NEW.length - 1} bytes, not the ${NEW.length} announced`
      ],
      [
        'fails its self-test',
        () => selfTest.mockRejectedValue(new Error('exit code 1')),
        'the self-test failed: exit code 1'
      ],
      [
        'reports another version',
        () => selfTest.mockResolvedValue('0.1.9'),
        'the self-test reported 0.1.9, not 0.2.1'
      ]
    ])(
      '[AGT-081] refuses a binary that %s, and leaves nothing behind',
      async (_case, arrange, reason) => {
        arrange();
        const agent = updater();
        await agent.recover();

        await agent.offer(offerFor(NEW), credentials);

        expect(contents(executable)).toBe(OLD.toString());
        expect(existsSync(`${executable}.new`)).toBe(false);
        expect(existsSync(`${executable}.old`)).toBe(false);
        expect(restart).not.toHaveBeenCalled();
        expect((await state()).report).toEqual({
          type: 'update.result',
          version: '0.2.1',
          outcome: 'rejected',
          reason
        });
      }
    );

    it('[AGT-081] ignores a version that is not newer than its own', async () => {
      const agent = updater();
      await agent.recover();

      await agent.offer(
        offerFor(NEW, { version: '0.2.0' }),
        credentials
      );

      expect(fetchFn).not.toHaveBeenCalled();
      expect((await state()).report).toBeNull();
    });

    it('[AGT-081] never tries again a version that failed here', async () => {
      await store.save({
        trial: null,
        report: null,
        failed: ['0.2.1']
      });
      const agent = updater();
      await agent.recover();

      await agent.offer(offerFor(NEW), credentials);

      expect(fetchFn).not.toHaveBeenCalled();
    });

    it('[AGT-081] handles one offer at a time', async () => {
      const agent = updater();
      await agent.recover();

      await Promise.all([
        agent.offer(offerFor(NEW), credentials),
        agent.offer(offerFor(NEW), credentials)
      ]);

      expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    it('[AGT-081] retries a failed download a few times, without counting it as a failed version', async () => {
      fetchFn.mockRejectedValue(new Error('ECONNRESET'));
      const agent = updater({ maxAttempts: 3 });
      await agent.recover();

      await agent.offer(offerFor(NEW), credentials);
      await new Promise((resolve) => setTimeout(resolve, 80));

      expect(fetchFn).toHaveBeenCalledTimes(3);
      expect(await state()).toEqual({
        trial: null,
        report: null,
        failed: []
      });
      agent.stop();
    });

    it('[AGT-081] a later attempt can still succeed', async () => {
      fetchFn.mockResolvedValueOnce(
        new Response(null, { status: 503 })
      );
      const agent = updater();
      await agent.recover();

      await agent.offer(offerFor(NEW), credentials);
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(fetchFn).toHaveBeenCalledTimes(2);
      expect(contents(executable)).toBe(NEW.toString());
      expect(restart).toHaveBeenCalled();
    });
  });

  describe('the new version on trial', () => {
    const installed = async () => {
      const old = updater();
      await old.recover();
      await old.offer(offerFor(NEW), credentials);
    };

    it('[AGT-085] is confirmed by its first welcome, and the previous version deleted', async () => {
      await installed();
      const next = updater({ version: '0.2.1' });

      expect(await next.recover()).toBe(true);
      const report = await next.welcomed();

      expect(report).toEqual({
        type: 'update.result',
        version: '0.2.1',
        outcome: 'installed'
      });
      expect(existsSync(`${executable}.old`)).toBe(false);
      expect((await state()).trial).toBeNull();
      next.stop();
    });

    it('[AGT-085] puts the previous version back when no welcome comes in time', async () => {
      await installed();
      restart.mockClear();
      const next = updater({ version: '0.2.1', trialMs: 20 });

      await next.recover();
      await new Promise((resolve) => setTimeout(resolve, 60));

      expect(contents(executable)).toBe(OLD.toString());
      expect(contents(`${executable}.new`)).toBe(NEW.toString());
      expect(existsSync(`${executable}.old`)).toBe(false);
      expect(restart).toHaveBeenCalledTimes(1);
      expect(await state()).toEqual({
        trial: null,
        report: {
          type: 'update.result',
          version: '0.2.1',
          outcome: 'rolled-back',
          reason: 'did not reach the backend within 2 minutes'
        },
        failed: ['0.2.1']
      });
    });

    it('[AGT-085] a welcome after the rollback started confirms nothing', async () => {
      await installed();
      const next = updater({ version: '0.2.1', trialMs: 20 });
      await next.recover();
      await new Promise((resolve) => setTimeout(resolve, 60));

      const report = await next.welcomed();

      expect(report?.outcome).toBe('rolled-back');
    });

    it('[AGT-085] puts the previous version back on the start after its third', async () => {
      await installed();
      restart.mockClear();
      for (let i = 0; i < 3; i++) {
        const next = updater({ version: '0.2.1' });
        expect(await next.recover()).toBe(true);
        next.stop();
      }

      const fourth = updater({ version: '0.2.1' });

      expect(await fourth.recover()).toBe(false);
      expect(contents(executable)).toBe(OLD.toString());
      expect(restart).toHaveBeenCalledTimes(1);
      expect((await state()).report).toMatchObject({
        outcome: 'rolled-back',
        reason: 'stopped 3 times before reaching the backend'
      });
    });

    it('[AGT-085] the previous version, back in place, removes the failed binary and keeps the report', async () => {
      await installed();
      const next = updater({ version: '0.2.1', trialMs: 20 });
      await next.recover();
      await new Promise((resolve) => setTimeout(resolve, 60));

      const previous = updater();
      expect(await previous.recover()).toBe(true);

      expect(existsSync(`${executable}.new`)).toBe(false);
      expect((await previous.welcomed())?.outcome).toBe(
        'rolled-back'
      );
    });

    it('[AGT-085] the previous version starting mid-trial records the update as rolled back', async () => {
      await installed();
      writeFileSync(executable, OLD);

      const previous = updater();
      await previous.recover();

      expect(await state()).toEqual({
        trial: null,
        report: {
          type: 'update.result',
          version: '0.2.1',
          outcome: 'rolled-back',
          reason:
            'the previous version started again before the new one reached the backend'
        },
        failed: ['0.2.1']
      });
    });

    it('[AGT-085] a version installed by hand mid-trial clears the trial and reports nothing', async () => {
      await installed();

      const manual = updater({ version: '0.3.0' });
      await manual.recover();

      expect(await state()).toEqual({
        trial: null,
        report: null,
        failed: []
      });
    });

    it('[AGT-084] the last report is handed back after every welcome', async () => {
      await installed();
      const next = updater({ version: '0.2.1' });
      await next.recover();

      const first = await next.welcomed();
      const second = await next.welcomed();

      expect(second).toEqual(first);
      next.stop();
    });

    it('[AGT-085] takes no offer while on trial', async () => {
      await installed();
      fetchFn.mockClear();
      const next = updater({ version: '0.2.1' });
      await next.recover();

      await next.offer(
        offerFor(NEW, { version: '0.2.2' }),
        credentials
      );
      await flush();

      expect(fetchFn).not.toHaveBeenCalled();
      next.stop();
    });
  });

  it('starts empty from a missing or unreadable state file', async () => {
    writeFileSync(path.join(dir, 'update.json'), '{not json');

    expect(await state()).toEqual({
      trial: null,
      report: null,
      failed: []
    });
  });
});
