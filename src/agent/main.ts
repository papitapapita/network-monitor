import { PingService } from 'infrastructure/monitoring/ping/PingService';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import { PingCycleProbe } from 'application/device-monitoring/services/PingCycleProbe';
import { promises as fs } from 'fs';
import { isSea } from 'node:sea';
import { AgentRuntime } from './AgentRuntime';
import { AGENT_VERSION } from './version';
import { loadAgentSettings } from './config/AgentSettings';
import { ConfigStore } from './config/ConfigStore';
import { CredentialStore } from './identity/CredentialStore';
import { PairingKeySource } from './identity/PairingKeySource';
import {
  DpapiProtector,
  FilePermissionProtector
} from './identity/SecretProtector';
import { enrollAgent } from './identity/enrollAgent';
import { PollScheduler } from './polling/PollScheduler';
import { ResultBuffer } from './results/ResultBuffer';
import {
  BackendConnection,
  DEFAULT_CONNECTION_OPTIONS
} from './connection/BackendConnection';
import {
  AgentUpdater,
  UPDATE_RESTART_EXIT_CODE
} from './update/AgentUpdater';
import { UpdateStateStore } from './update/UpdateStateStore';
import {
  SELF_TEST_FLAG,
  agentPlatform,
  runSelfTest,
  selfTest
} from './update/selfTest';

// The on-site agent's composition root (ADR 0002). It only measures and
// reports; nothing here reaches a database, Express or a use case.
async function main(): Promise<void> {
  if (process.argv.includes('--version')) {
    process.stdout.write(`${AGENT_VERSION}\n`);
    return;
  }
  if (process.argv.includes(SELF_TEST_FLAG)) {
    process.stdout.write(`${selfTest(AGENT_VERSION)}\n`);
    return;
  }
  const settings = loadAgentSettings(
    process.env,
    process.argv.slice(2),
    process.platform
  );
  const logger = new WinstonLogger({ component: 'agent' });
  await fs.mkdir(settings.dataDir, { recursive: true, mode: 0o700 });

  let runtime: AgentRuntime | null = null;
  let stopping = false;
  const exitWith = async (code: number, signal: string) => {
    if (stopping) return;
    stopping = true;
    logger.info('Agent stopping', { signal });
    await runtime?.stop();
    process.exit(code);
  };

  // Only a packaged binary can replace itself; under ts-node there is no
  // binary to swap, so the hello names no platform and nothing is offered.
  const platform = isSea()
    ? agentPlatform(process.platform, process.arch)
    : null;
  const updater = platform
    ? new AgentUpdater({
        store: new UpdateStateStore(settings.dataDir),
        executable: process.execPath,
        platform,
        version: AGENT_VERSION,
        logger,
        selfTest: runSelfTest,
        restart: () =>
          void exitWith(UPDATE_RESTART_EXIT_CODE, 'update')
      })
    : undefined;
  if (updater && !(await updater.recover())) return;

  const buffer = await ResultBuffer.open(settings.dataDir, logger);
  const scheduler = new PollScheduler(
    new PingCycleProbe(new PingService()),
    (result) => buffer.add(result),
    logger
  );
  runtime = new AgentRuntime({
    credentials: new CredentialStore(
      settings.dataDir,
      process.platform === 'win32'
        ? new DpapiProtector()
        : new FilePermissionProtector()
    ),
    pairingKey: new PairingKeySource(
      settings.dataDir,
      settings.pairingKey
    ),
    enroll: (key) => enrollAgent(key),
    config: new ConfigStore(settings.dataDir),
    buffer,
    scheduler,
    connect: (credentials, callbacks) =>
      new BackendConnection(credentials, buffer, callbacks, logger, {
        ...DEFAULT_CONNECTION_OPTIONS,
        agentVersion: AGENT_VERSION,
        ...(platform && { platform })
      }),
    logger,
    updater
  });

  logger.info('Agent starting', {
    version: AGENT_VERSION,
    dataDir: settings.dataDir
  });
  await runtime.start();

  process.on('SIGINT', () => void exitWith(0, 'SIGINT'));
  process.on('SIGTERM', () => void exitWith(0, 'SIGTERM'));
}

main().catch((error) => {
  new WinstonLogger({ component: 'agent' }).fatal(
    'Agent failed to start',
    error instanceof Error ? error : new Error(String(error))
  );
  process.exit(1);
});
