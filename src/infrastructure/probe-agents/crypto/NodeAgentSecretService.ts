import { createHash, randomBytes } from 'crypto';
import { IAgentSecretService } from 'application/probe-agents/interfaces';

const SECRET_BYTES = 32;

export class NodeAgentSecretService implements IAgentSecretService {
  generate(): string {
    return randomBytes(SECRET_BYTES).toString('base64url');
  }

  hash(secret: string): string {
    return createHash('sha256').update(secret, 'utf8').digest('hex');
  }
}
