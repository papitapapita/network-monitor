import { PingService } from 'infrastructure/monitoring/ping/PingService';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import { PingCycleProbe } from 'application/device-monitoring/services/PingCycleProbe';
import { promises as fs } from 'fs';
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

// The on-site agent's composition root (ADR 0002). It only measures and
// reports; nothing here reaches a database, Express or a use case.
async function main(): Promise<void> {
  const settings = loadAgentSettings(
    process.env,
    process.argv.slice(2),
    process.platform
  );
  const logger = new WinstonLogger({ component: 'agent' });
  await fs.mkdir(settings.dataDir, { recursive: true, mode: 0o700 });

  const buffer = await ResultBuffer.open(settings.dataDir, logger);
  const scheduler = new PollScheduler(
    new PingCycleProbe(new PingService()),
    (result) => buffer.add(result),
    logger
  );
  const runtime = new AgentRuntime({
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
        agentVersion: AGENT_VERSION
      }),
    logger
  });

  logger.info('Agent starting', {
    version: AGENT_VERSION,
    dataDir: settings.dataDir
  });
  await runtime.start();

  let stopping = false;
  const shutdown = async (signal: string) => {
    if (stopping) return;
    stopping = true;
    logger.info('Agent stopping', { signal });
    await runtime.stop();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((error) => {
  new WinstonLogger({ component: 'agent' }).fatal(
    'Agent failed to start',
    error instanceof Error ? error : new Error(String(error))
  );
  process.exit(1);
});
