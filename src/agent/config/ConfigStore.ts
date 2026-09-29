import path from 'path';
import { ConfigDeviceWire } from 'agent/protocol';
import {
  readFileIfExists,
  removeIfExists,
  writeFileAtomic
} from './writeFileAtomic';

export interface SavedConfig {
  version: string;
  devices: ConfigDeviceWire[];
}

// The last configuration the backend sent, so a PC that restarts while the
// internet is down still knows what to poll and keeps buffering (R13). It
// holds addresses and intervals only: device credentials, when they arrive
// (phase 3), are never written to disk (R15).
export class ConfigStore {
  private readonly filePath: string;

  constructor(dataDir: string) {
    this.filePath = path.join(dataDir, 'config.json');
  }

  async load(): Promise<SavedConfig | null> {
    const raw = await readFileIfExists(this.filePath);
    if (raw === null) return null;
    try {
      const parsed = JSON.parse(raw) as SavedConfig;
      return Array.isArray(parsed.devices) ? parsed : null;
    } catch {
      return null;
    }
  }

  async save(config: SavedConfig): Promise<void> {
    const devices = config.devices.map(
      ({ d, ip, intervalSeconds, failuresBeforeDown }) => ({
        d,
        ip,
        intervalSeconds,
        failuresBeforeDown
      })
    );
    await writeFileAtomic(
      this.filePath,
      JSON.stringify({ version: config.version, devices })
    );
  }

  async clear(): Promise<void> {
    await removeIfExists(this.filePath);
  }
}
