import path from 'path';
import {
  readFileIfExists,
  removeIfExists
} from '../config/writeFileAtomic';

// Where a pairing key waits until the agent has used it: given at start-up,
// or left in `pairing.key` by the installer. The file is read by the service
// itself, so the token it produces is sealed for the service's account.
export class PairingKeySource {
  private readonly filePath: string;
  private given: string | null;

  constructor(dataDir: string, given: string | null) {
    this.filePath = path.join(dataDir, 'pairing.key');
    this.given = given;
  }

  async read(): Promise<string | null> {
    if (this.given) return this.given;
    const raw = await readFileIfExists(this.filePath);
    return raw?.trim() || null;
  }

  // A key works once: after it was used or refused it is only a stale secret.
  async discard(): Promise<void> {
    this.given = null;
    await removeIfExists(this.filePath);
  }
}
