import path from 'path';

export interface AgentSettings {
  dataDir: string;
  // A key given on the command line or in the environment; the installer
  // leaves one in `pairing.key` inside the data directory instead.
  pairingKey: string | null;
}

export function loadAgentSettings(
  env: NodeJS.ProcessEnv,
  argv: string[],
  platform: NodeJS.Platform
): AgentSettings {
  const pairFlag = argv.indexOf('--pair');
  const pairingKey =
    (pairFlag >= 0 ? argv[pairFlag + 1] : undefined) ??
    env.NMS_AGENT_PAIRING_KEY;

  return {
    dataDir:
      env.NMS_AGENT_DATA_DIR?.trim() || defaultDataDir(env, platform),
    pairingKey: pairingKey?.trim() || null
  };
}

function defaultDataDir(
  env: NodeJS.ProcessEnv,
  platform: NodeJS.Platform
): string {
  if (platform === 'win32') {
    return path.win32.join(
      env.ProgramData ?? 'C:\\ProgramData',
      'NmsAgent'
    );
  }
  return '/var/lib/nms-agent';
}
