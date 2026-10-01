import { createHash } from 'crypto';
import { Agent, AgentName } from '../../../src/domain/probe-agents';
import { IAgentRepository } from '../../../src/domain/probe-agents/repository';
import { AgentId } from '../../../src/domain/shared/ids';
import { Result } from '../../../src/domain/shared/core/Result';
import {
  AgentPingResult,
  AgentPollingTarget,
  AgentReleaseDownload,
  IAgentReleaseCatalog,
  IAgentDeviceCountQuery,
  IAgentDeviceIndex,
  IAgentPingResultSink,
  IAgentPollingTargetsQuery,
  IAgentSecretService
} from '../../../src/application/probe-agents/interfaces';
import { ILogger } from '../../../src/application/shared/interfaces/ILogger';
import { ReleaseManifest } from '../../../src/agent/protocol';

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

  // Mirrors the updatedAt compare-and-set in PrismaAgentRepository. A test
  // simulates a concurrent writer by bumping storedUpdatedAt in between.
  readonly savedIfUnchanged: Agent[] = [];
  async saveIfUnchanged(
    agent: Agent,
    loadedUpdatedAt: Date
  ): Promise<Result<boolean>> {
    if (this.failWith) return Result.fail(this.failWith);
    const stored = this.storedUpdatedAt.get(agent.id.toString());
    if (stored?.getTime() !== loadedUpdatedAt.getTime()) {
      return Result.ok(false);
    }
    this.store(agent);
    this.savedIfUnchanged.push(agent);
    return Result.ok(true);
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

  async findByTokenHash(hash: string): Promise<Result<Agent | null>> {
    if (this.failWith) return Result.fail(this.failWith);
    for (const agent of this.agents.values()) {
      if (agent.tokenHash === hash) return Result.ok(agent);
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
  readonly storedUpdatedAt = new Map<string, Date>();

  seed(agent: Agent): Agent {
    this.store(agent);
    return agent;
  }

  private store(agent: Agent): void {
    const id = agent.id.toString();
    this.agents.set(id, agent);
    this.storedUpdatedAt.set(id, agent.updatedAt);
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

export function makeActiveAgent(
  secrets: FakeAgentSecretService,
  token: string,
  name = 'Torre Norte'
): Agent {
  const agent = makePendingAgent(
    secrets,
    `code-for-${token}`,
    new Date(),
    name
  );
  agent.enroll(secrets.hash(token));
  return agent;
}

export class FakeDeviceCounts implements IAgentDeviceCountQuery {
  counts = new Map<string, number>();
  async countByAgent(
    agentIds: AgentId[]
  ): Promise<Result<Map<string, number>>> {
    const wanted = new Set(agentIds.map((id) => id.toString()));
    return Result.ok(
      new Map([...this.counts].filter(([id]) => wanted.has(id)))
    );
  }
}

export class FakeTargetsQuery implements IAgentPollingTargetsQuery {
  targets: AgentPollingTarget[] = [];
  async listForAgent(): Promise<Result<AgentPollingTarget[]>> {
    return Result.ok(this.targets);
  }
}

// Mirrors PrismaAgentDeviceIndex: indexes come from an ever-increasing
// counter, and resolving only answers for devices still on the agent.
export class FakeDeviceIndex implements IAgentDeviceIndex {
  private next = 0;
  readonly indexes = new Map<string, number>();
  readonly assignedToAgent = new Set<string>();

  async indexesFor(
    _agentId: AgentId,
    deviceIds: string[]
  ): Promise<Result<Map<string, number>>> {
    for (const id of deviceIds) {
      if (!this.indexes.has(id)) this.indexes.set(id, this.next++);
    }
    return Result.ok(
      new Map(deviceIds.map((id) => [id, this.indexes.get(id)!]))
    );
  }

  async resolveAssigned(
    _agentId: AgentId,
    wanted: number[]
  ): Promise<Result<Map<number, string>>> {
    const out = new Map<number, string>();
    for (const [deviceId, index] of this.indexes) {
      if (
        wanted.includes(index) &&
        this.assignedToAgent.has(deviceId)
      ) {
        out.set(index, deviceId);
      }
    }
    return Result.ok(out);
  }
}

export class FakeResultSink implements IAgentPingResultSink {
  readonly accepted: AgentPingResult[] = [];
  failFor = new Set<string>();

  async accept(result: AgentPingResult): Promise<Result<void>> {
    if (this.failFor.has(result.deviceId))
      return Result.fail('db down');
    this.accepted.push(result);
    return Result.ok();
  }
}

// The releases an install offers, set by the test (AGT-082).
export class FakeReleaseCatalog implements IAgentReleaseCatalog {
  release: ReleaseManifest | null = null;
  files = new Map<string, AgentReleaseDownload>();
  failWith: string | null = null;

  async latest(): Promise<Result<ReleaseManifest | null>> {
    if (this.failWith) return Result.fail(this.failWith);
    return Result.ok(this.release);
  }

  async open(
    fileName: string
  ): Promise<Result<AgentReleaseDownload | null>> {
    if (this.failWith) return Result.fail(this.failWith);
    return Result.ok(this.files.get(fileName) ?? null);
  }

  publish(version: string): ReleaseManifest {
    this.release = {
      version,
      files: {
        'linux-x64': {
          file: `nms-agent-${version}-linux-x64.gz`,
          sha256: 'a'.repeat(64),
          bytes: 1000,
          signature: 'c2ln'
        }
      }
    };
    return this.release;
  }
}
