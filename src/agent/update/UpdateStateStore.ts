import path from 'path';
import { UpdateResultMessage } from 'agent/protocol';
import {
  readFileIfExists,
  writeFileAtomic
} from '../config/writeFileAtomic';

export interface UpdateTrial {
  version: string;
  previousVersion: string;
  // How many times the new version has started without reaching the backend.
  starts: number;
}

export interface UpdateState {
  // Set from just before the swap until the new version's first welcome.
  trial: UpdateTrial | null;
  // How the last attempt ended; sent after every welcome (AGT-084).
  report: UpdateResultMessage | null;
  // Versions that failed on this PC, never tried again (AGT-081).
  failed: string[];
}

const KEPT_FAILURES = 20;

export const EMPTY_UPDATE_STATE: UpdateState = {
  trial: null,
  report: null,
  failed: []
};

// The self-update's memory, in `update.json`. It has to outlive the process
// it describes: the new version reads what the old one left, and the old one,
// once restored, reads what the new one left.
export class UpdateStateStore {
  private readonly filePath: string;

  constructor(dataDir: string) {
    this.filePath = path.join(dataDir, 'update.json');
  }

  async load(): Promise<UpdateState> {
    const raw = await readFileIfExists(this.filePath);
    if (raw === null) return EMPTY_UPDATE_STATE;
    try {
      const parsed = JSON.parse(raw) as Partial<UpdateState>;
      return {
        trial: parsed.trial ?? null,
        report: parsed.report ?? null,
        failed: Array.isArray(parsed.failed) ? parsed.failed : []
      };
    } catch {
      return EMPTY_UPDATE_STATE;
    }
  }

  async save(state: UpdateState): Promise<void> {
    await writeFileAtomic(
      this.filePath,
      JSON.stringify({
        ...state,
        failed: state.failed.slice(-KEPT_FAILURES)
      })
    );
  }
}
