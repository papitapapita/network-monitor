import path from 'path';
import {
  readFileIfExists,
  removeIfExists,
  writeFileAtomic
} from '../config/writeFileAtomic';
import { ISecretProtector } from './SecretProtector';

export interface AgentCredentials {
  backendUrl: string;
  token: string;
  agentName: string;
}

interface StoredCredentials {
  backendUrl: string;
  agentName: string;
  protection: ISecretProtector['kind'];
  token: string;
}

export class CredentialStore {
  private readonly filePath: string;

  constructor(
    dataDir: string,
    private readonly protector: ISecretProtector
  ) {
    this.filePath = path.join(dataDir, 'agent.json');
  }

  async load(): Promise<AgentCredentials | null> {
    const raw = await readFileIfExists(this.filePath);
    if (raw === null) return null;
    const stored = JSON.parse(raw) as StoredCredentials;
    if (stored.protection !== this.protector.kind) {
      throw new Error(
        `Token was stored with ${stored.protection}, this platform uses ${this.protector.kind}`
      );
    }
    return {
      backendUrl: stored.backendUrl,
      agentName: stored.agentName,
      token: await this.protector.unprotect(stored.token)
    };
  }

  async save(credentials: AgentCredentials): Promise<void> {
    const stored: StoredCredentials = {
      backendUrl: credentials.backendUrl,
      agentName: credentials.agentName,
      protection: this.protector.kind,
      token: await this.protector.protect(credentials.token)
    };
    await writeFileAtomic(this.filePath, JSON.stringify(stored));
  }

  async clear(): Promise<void> {
    await removeIfExists(this.filePath);
  }
}
