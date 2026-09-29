// Pairing codes and agent tokens are high-entropy random values, so a fast
// hash is enough: there is nothing to brute-force, and a deterministic hash
// lets the backend find the agent by it in one indexed lookup.
export interface IAgentSecretService {
  generate(): string;
  hash(secret: string): string;
}
