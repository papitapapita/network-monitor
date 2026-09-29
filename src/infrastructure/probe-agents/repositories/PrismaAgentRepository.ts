import { PrismaClient, ProbeAgent } from 'generated/prisma/client';
import { Agent } from 'domain/probe-agents';
import { IAgentRepository } from 'domain/probe-agents/repository';
import { AgentId } from 'domain/shared/ids';
import { Result } from 'domain/shared/core';
import { AgentPrismaMapper } from '../mappers';
import { isUniqueViolation } from '../../persistence/prisma-errors';

export class PrismaAgentRepository implements IAgentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  public async save(agent: Agent): Promise<Result<Agent>> {
    try {
      const { id, createdAt, ...changes } =
        AgentPrismaMapper.toPersistence(agent);
      const raw = await this.prisma.probeAgent.upsert({
        where: { id },
        create: { id, createdAt, ...changes },
        update: changes
      });
      return AgentPrismaMapper.toDomain(raw);
    } catch (error) {
      if (isUniqueViolation(error)) {
        return Result.fail(
          `An agent named "${agent.name.value}" already exists`
        );
      }
      return Result.fail(
        `Database error saving agent: ${this.message(error)}`
      );
    }
  }

  public async saveEnrollment(
    agent: Agent,
    consumedPairingCodeHash: string
  ): Promise<Result<Agent | null>> {
    try {
      const {
        id,
        createdAt: _createdAt,
        ...changes
      } = AgentPrismaMapper.toPersistence(agent);
      const { count } = await this.prisma.probeAgent.updateMany({
        where: { id, pairingCodeHash: consumedPairingCodeHash },
        data: changes
      });
      if (count === 0) return Result.ok(null);
      return this.findById(agent.id);
    } catch (error) {
      return Result.fail(
        `Database error saving agent enrollment: ${this.message(error)}`
      );
    }
  }

  public async findById(id: AgentId): Promise<Result<Agent | null>> {
    return this.findOne(
      () =>
        this.prisma.probeAgent.findUnique({
          where: { id: id.toString() }
        }),
      'finding agent'
    );
  }

  public async findByPairingCodeHash(
    hash: string
  ): Promise<Result<Agent | null>> {
    return this.findOne(
      () =>
        this.prisma.probeAgent.findUnique({
          where: { pairingCodeHash: hash }
        }),
      'finding agent by pairing code'
    );
  }

  public async findByTokenHash(
    hash: string
  ): Promise<Result<Agent | null>> {
    return this.findOne(
      () =>
        this.prisma.probeAgent.findUnique({
          where: { tokenHash: hash }
        }),
      'finding agent by token'
    );
  }

  public async findAll(): Promise<Result<Agent[]>> {
    try {
      const rows = await this.prisma.probeAgent.findMany({
        orderBy: { createdAt: 'asc' }
      });
      const agents: Agent[] = [];
      for (const row of rows) {
        const mapped = AgentPrismaMapper.toDomain(row);
        if (mapped.isFailure) {
          return Result.fail(`Failed to map agent: ${mapped.error}`);
        }
        agents.push(mapped.value);
      }
      return Result.ok(agents);
    } catch (error) {
      return Result.fail(
        `Database error finding agents: ${this.message(error)}`
      );
    }
  }

  private async findOne(
    query: () => Promise<ProbeAgent | null>,
    action: string
  ): Promise<Result<Agent | null>> {
    try {
      const row = await query();
      if (!row) return Result.ok(null);
      const mapped = AgentPrismaMapper.toDomain(row);
      if (mapped.isFailure) {
        return Result.fail(`Failed to map agent: ${mapped.error}`);
      }
      return Result.ok(mapped.value);
    } catch (error) {
      return Result.fail(
        `Database error ${action}: ${this.message(error)}`
      );
    }
  }

  private message(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
