import { createHash } from 'crypto';
import { Agent, AgentName } from '../../../src/domain/probe-agents';
import { IAgentRepository } from '../../../src/domain/probe-agents/repository';
import { AgentId } from '../../../src/domain/shared/ids';
import { Result } from '../../../src/domain/shared/core/Result';
import { IAgentSecretService } from '../../../src/application/probe-agents/interfaces';
import { ILogger } from '../../../src/application/shared/interfaces/ILogger';

export const BACKEND_URL = 'https://api.example.com';

export function makeLogger(): jest.Mocked<ILogger> {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
    child: jest.fn().mockReturnThis(),
    setLevel: jest.fn()
  };
}

// Deterministic secrets so a test can present the code it was handed.
export class FakeAgentSecretService implements IAgentSecretService {
  private counter = 0;

  generate(): string {
    this.counter++;
    return `secret-${this.counter}`;
  }

  hash(secret: string): string {
    return createHash('sha256').update(secret).digest('hex');
  }
}

export class InMemoryAgentRepository implements IAgentRepository {
  readonly agents = new Map<string, Agent>();
  failWith: string | null = null;

  async save(agent: Agent): Promise<Result<Agent>> {
    if (this.failWith) return Result.fail(this.failWith);
    for (const other of this.agents.values()) {
      if (
        !other.id.equals(agent.id) &&
        other.name.value === agent.name.value
      ) {
        return Result.fail(
          `An agent named "${agent.name.value}" already exists`
        );
      }
    }
    this.store(agent);
    return Result.ok(agent);
  }

  async saveEnrollment(
    agent: Agent,
    consumedPairingCodeHash: string
  ): Promise<Result<Agent | null>> {
    if (this.failWith) return Result.fail(this.failWith);
    const stored = this.storedPairingHashes.get(agent.id.toString());
    if (stored !== consumedPairingCodeHash) return Result.ok(null);
    this.store(agent);
    return Result.ok(agent);
  }

  async findById(id: AgentId): Promise<Result<Agent | null>> {
    if (this.failWith) return Result.fail(this.failWith);
    return Result.ok(this.agents.get(id.toString()) ?? null);
  }

  async findByPairingCodeHash(
    hash: string
  ): Promise<Result<Agent | null>> {
    if (this.failWith) return Result.fail(this.failWith);
    for (const [id, stored] of this.storedPairingHashes) {
      if (stored === hash)
        return Result.ok(this.agents.get(id) ?? null);
    }
    return Result.ok(null);
  }

  async findAll(): Promise<Result<Agent[]>> {
    if (this.failWith) return Result.fail(this.failWith);
    return Result.ok([...this.agents.values()]);
  }

  // What the database holds, independent of in-memory mutations of the
  // aggregate — mirrors the conditional update in PrismaAgentRepository.
  readonly storedPairingHashes = new Map<string, string>();

  seed(agent: Agent): Agent {
    this.store(agent);
    return agent;
  }

  private store(agent: Agent): void {
    const id = agent.id.toString();
    this.agents.set(id, agent);
    if (agent.pairingCodeHash) {
      this.storedPairingHashes.set(id, agent.pairingCodeHash);
    } else {
      this.storedPairingHashes.delete(id);
    }
  }
}

export function makePendingAgent(
  secrets: FakeAgentSecretService,
  pairingCode: string,
  now: Date = new Date(),
  name = 'Torre Norte'
): Agent {
  return Agent.create(
    AgentName.create(name).value,
    secrets.hash(pairingCode),
    now
  ).value;
}
