import { createHash } from 'crypto';
import { createWriteStream, promises as fs } from 'fs';
import { Readable, Transform } from 'stream';
import { pipeline } from 'stream/promises';
import type { ReadableStream } from 'stream/web';
import { createGunzip } from 'zlib';
import type { ILogger } from 'application/shared/interfaces';
import {
  AGENT_UPDATES_PATH,
  AgentPlatform,
  RELEASE_PUBLIC_KEY,
  UpdateMessage,
  UpdateResultMessage,
  isNewerVersion,
  releaseFileName,
  verifyReleaseSignature
} from 'agent/protocol';
import { removeIfExists } from '../config/writeFileAtomic';
import { AgentCredentials } from '../identity/CredentialStore';
import {
  EMPTY_UPDATE_STATE,
  UpdateState,
  UpdateStateStore
} from './UpdateStateStore';

// Exit code that asks the service manager for a restart: WinSW restarts on
// any non-zero exit, systemd on any exit.
export const UPDATE_RESTART_EXIT_CODE = 75;

export interface AgentUpdaterDeps {
  store: UpdateStateStore;
  // The running binary: process.execPath in a packaged agent.
  executable: string;
  platform: AgentPlatform;
  version: string;
  logger: ILogger;
  // Runs `<binary> --self-test`; resolves to the version it printed.
  selfTest: (binary: string) => Promise<string>;
  // Stops the agent and exits, so the service manager starts whatever binary
  // is in place by then.
  restart: () => void;
  fetchFn?: typeof fetch;
  publicKeyPem?: string;
  trialMs?: number;
  maxTrialStarts?: number;
  retryMs?: number;
  maxAttempts?: number;
  downloadTimeoutMs?: number;
}

type Attempt =
  | { kind: 'ready' }
  | { kind: 'rejected'; reason: string }
  | { kind: 'retry'; reason: string };

class TooLarge extends Error {}

// The agent's side of self-update (ADR 0002, phase 2). An offer is
// downloaded beside the running binary, checked, self-tested and swapped in
// (AGT-081); the new version then has to reach the backend or the previous
// one is put back (AGT-085). How it ended is reported after every welcome
// (AGT-084).
export class AgentUpdater {
  private state: UpdateState = EMPTY_UPDATE_STATE;
  private busy = false;
  private rollingBack = false;
  private trialTimer: ReturnType<typeof setTimeout> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly oldPath: string;
  private readonly newPath: string;

  constructor(private readonly deps: AgentUpdaterDeps) {
    this.oldPath = `${deps.executable}.old`;
    this.newPath = `${deps.executable}.new`;
  }

  // At startup, before connecting. False when it is putting the previous
  // version back and the agent is about to restart.
  async recover(): Promise<boolean> {
    this.state = await this.deps.store.load();
    const { trial } = this.state;
    const { version, logger } = this.deps;

    if (trial?.version === version) {
      const starts = trial.starts + 1;
      if (starts > (this.deps.maxTrialStarts ?? 3)) {
        await this.rollBack(
          `stopped ${trial.starts} times before reaching the backend`
        );
        return false;
      }
      await this.save({ ...this.state, trial: { ...trial, starts } });
      logger.info('Running a new version on trial', {
        version,
        previousVersion: trial.previousVersion
      });
      this.trialTimer = setTimeout(
        () =>
          void this.rollBack(
            'did not reach the backend within 2 minutes'
          ),
        this.deps.trialMs ?? 2 * 60_000
      );
      return true;
    }

    if (trial?.previousVersion === version) {
      // The rollback finished its files but not its record, or the swap
      // never happened: either way the new version did not run here.
      const recorded =
        this.state.report?.version === trial.version &&
        this.state.report.outcome === 'rolled-back';
      if (recorded) await this.save({ ...this.state, trial: null });
      else
        await this.fail(
          trial.version,
          'rolled-back',
          'the previous version started again before the new one reached the backend'
        );
    } else if (trial) {
      // Someone installed another version by hand meanwhile.
      await this.save({ ...this.state, trial: null });
    }
    await this.removeQuietly(this.newPath);
    return true;
  }

  // After every welcome: confirms a version on trial, then hands back the
  // report to send.
  async welcomed(): Promise<UpdateResultMessage | null> {
    const { trial } = this.state;
    if (trial?.version === this.deps.version && !this.rollingBack) {
      if (this.trialTimer) clearTimeout(this.trialTimer);
      this.trialTimer = null;
      await this.save({
        ...this.state,
        trial: null,
        report: {
          type: 'update.result',
          version: trial.version,
          outcome: 'installed'
        }
      });
      await this.removeQuietly(this.oldPath);
      this.deps.logger.info('Update installed', {
        version: trial.version,
        previousVersion: trial.previousVersion
      });
    }
    return this.state.report;
  }

  async offer(
    offer: UpdateMessage,
    credentials: AgentCredentials,
    attempt = 1
  ): Promise<void> {
    const { logger, version } = this.deps;
    if (this.busy || this.state.trial) return;
    if (!isNewerVersion(offer.version, version)) {
      logger.warn('Ignoring an update that is not newer', {
        offered: offer.version,
        running: version
      });
      return;
    }
    if (this.state.failed.includes(offer.version)) {
      logger.debug('Ignoring an update that already failed here', {
        offered: offer.version
      });
      return;
    }

    this.busy = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    try {
      logger.info('Downloading an update', {
        version: offer.version,
        bytes: offer.bytes
      });
      const result = await this.prepare(offer, credentials);
      if (result.kind === 'ready') {
        await this.swap(offer.version);
        return;
      }
      await this.removeQuietly(this.newPath);
      if (result.kind === 'rejected') {
        await this.fail(offer.version, 'rejected', result.reason);
        return;
      }
      const maxAttempts = this.deps.maxAttempts ?? 3;
      logger.warn('Could not download the update', {
        version: offer.version,
        reason: result.reason,
        attempt,
        willRetry: attempt < maxAttempts
      });
      if (attempt < maxAttempts) {
        this.retryTimer = setTimeout(
          () => {
            this.retryTimer = null;
            void this.offer(offer, credentials, attempt + 1);
          },
          this.deps.retryMs ?? 15 * 60_000
        );
        this.retryTimer.unref?.();
      }
    } finally {
      this.busy = false;
    }
  }

  stop(): void {
    if (this.trialTimer) clearTimeout(this.trialTimer);
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.trialTimer = null;
    this.retryTimer = null;
  }

  // Leaves the checked binary at `.new`, or says why not.
  private async prepare(
    offer: UpdateMessage,
    credentials: AgentCredentials
  ): Promise<Attempt> {
    const { platform } = this.deps;
    if (offer.file !== releaseFileName(offer.version, platform)) {
      return rejected(`${offer.file} is not the ${platform} binary`);
    }
    if (
      !verifyReleaseSignature(
        offer.version,
        platform,
        offer.sha256,
        offer.signature,
        this.deps.publicKeyPem ?? RELEASE_PUBLIC_KEY
      )
    ) {
      return rejected('the signature does not verify');
    }

    const downloaded = await this.download(offer, credentials);
    if (downloaded.kind !== 'ready') return downloaded;

    let reported: string;
    try {
      reported = await this.deps.selfTest(this.newPath);
    } catch (error) {
      return rejected(`the self-test failed: ${message(error)}`);
    }
    if (reported !== offer.version) {
      return rejected(
        `the self-test reported ${reported || 'nothing'}, not ${offer.version}`
      );
    }
    return { kind: 'ready' };
  }

  private async download(
    offer: UpdateMessage,
    credentials: AgentCredentials
  ): Promise<Attempt> {
    const fetchFn = this.deps.fetchFn ?? fetch;
    let response: Response;
    try {
      response = await fetchFn(
        `${credentials.backendUrl}${AGENT_UPDATES_PATH}/${offer.file}`,
        {
          headers: { Authorization: `Bearer ${credentials.token}` },
          signal: AbortSignal.timeout(
            this.deps.downloadTimeoutMs ?? 30 * 60_000
          )
        }
      );
    } catch (error) {
      return retry(message(error));
    }
    if (response.status !== 200 || !response.body) {
      return retry(`the backend answered ${response.status}`);
    }

    const hash = createHash('sha256');
    let bytes = 0;
    try {
      await pipeline(
        Readable.fromWeb(response.body as ReadableStream),
        createGunzip(),
        new Transform({
          transform(chunk: Buffer, _encoding, done) {
            bytes += chunk.length;
            if (bytes > offer.bytes) {
              done(new TooLarge());
              return;
            }
            hash.update(chunk);
            done(null, chunk);
          }
        }),
        createWriteStream(this.newPath, { mode: 0o755 })
      );
    } catch (error) {
      if (error instanceof TooLarge) {
        return rejected(
          `the binary is larger than the ${offer.bytes} bytes announced`
        );
      }
      return retry(message(error));
    }

    if (bytes !== offer.bytes) {
      return rejected(
        `the binary is ${bytes} bytes, not the ${offer.bytes} announced`
      );
    }
    if (hash.digest('hex') !== offer.sha256) {
      return rejected('the binary does not match its SHA-256');
    }
    return { kind: 'ready' };
  }

  // The trial is recorded first, so a power cut mid-swap still ends in a
  // decision on the next start.
  private async swap(target: string): Promise<void> {
    const { executable, logger, version } = this.deps;
    await this.save({
      ...this.state,
      trial: { version: target, previousVersion: version, starts: 0 }
    });
    try {
      await removeIfExists(this.oldPath);
      await fs.rename(executable, this.oldPath);
    } catch (error) {
      await this.removeQuietly(this.newPath);
      await this.fail(
        target,
        'rejected',
        `the running version could not be set aside: ${message(error)}`
      );
      return;
    }
    try {
      await fs.rename(this.newPath, executable);
    } catch (error) {
      await fs.rename(this.oldPath, executable);
      await this.removeQuietly(this.newPath);
      await this.fail(
        target,
        'rejected',
        `the new version could not be put in place: ${message(error)}`
      );
      return;
    }
    logger.info('Update in place; restarting into it', {
      version: target,
      previousVersion: version
    });
    this.deps.restart();
  }

  // The running binary moves to `.new`: Windows can rename a running
  // executable but not delete it. The previous version cleans it up.
  private async rollBack(reason: string): Promise<void> {
    const { trial } = this.state;
    if (!trial || this.rollingBack) return;
    this.rollingBack = true;
    if (this.trialTimer) clearTimeout(this.trialTimer);
    this.trialTimer = null;
    const { executable, logger } = this.deps;

    try {
      await fs.access(this.oldPath);
      await removeIfExists(this.newPath);
      await fs.rename(executable, this.newPath);
    } catch (error) {
      logger.error(
        'Could not put the previous version back; this one keeps running',
        error instanceof Error ? error : new Error(String(error)),
        { version: trial.version }
      );
      await this.save({ ...this.state, trial: null });
      this.rollingBack = false;
      return;
    }
    try {
      await fs.rename(this.oldPath, executable);
    } catch (error) {
      await fs.rename(this.newPath, executable);
      logger.error(
        'Could not put the previous version back; this one keeps running',
        error instanceof Error ? error : new Error(String(error)),
        { version: trial.version }
      );
      await this.save({ ...this.state, trial: null });
      this.rollingBack = false;
      return;
    }

    await this.fail(trial.version, 'rolled-back', reason);
    logger.warn(
      'Update rolled back; restarting into the previous version',
      {
        version: trial.version,
        previousVersion: trial.previousVersion,
        reason
      }
    );
    this.deps.restart();
  }

  private async fail(
    target: string,
    outcome: 'rolled-back' | 'rejected',
    reason: string
  ): Promise<void> {
    if (outcome === 'rejected') {
      this.deps.logger.warn('Update refused', {
        version: target,
        reason
      });
    }
    await this.save({
      trial: null,
      report: {
        type: 'update.result',
        version: target,
        outcome,
        reason: reason.slice(0, 500)
      },
      failed: [
        ...this.state.failed.filter((v) => v !== target),
        target
      ]
    });
  }

  private async save(state: UpdateState): Promise<void> {
    this.state = state;
    await this.deps.store.save(state);
  }

  private async removeQuietly(file: string): Promise<void> {
    try {
      await removeIfExists(file);
    } catch (error) {
      this.deps.logger.warn(
        'Could not remove a leftover update file',
        {
          file,
          error: message(error)
        }
      );
    }
  }
}

function rejected(reason: string): Attempt {
  return { kind: 'rejected', reason };
}

function retry(reason: string): Attempt {
  return { kind: 'retry', reason };
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
