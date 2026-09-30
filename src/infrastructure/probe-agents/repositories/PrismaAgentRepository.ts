import {
  Prisma,
  PrismaClient,
  ProbeAgent
} from 'generated/prisma/client';
import { Agent, AgentStatus } from 'domain/probe-agents';
import { IAgentRepository } from 'domain/probe-agents/repository';
import { AgentId } from 'domain/shared/ids';
import { EventDispatcher, Result } from 'domain/shared/core';
import { AgentPrismaMapper } from '../mappers';
import { isUniqueViolation } from '../../persistence/prisma-errors';

export class PrismaAgentRepository implements IAgentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  public async save(agent: Agent): Promise<Result<Agent>> {
    try {
      const { id, createdAt, ...changes } =
        AgentPrismaMapper.toPersistence(agent);
      EventDispatcher.markAggregateForDispatch(agent);
      const raw = await this.prisma.$transaction(async (tx) => {
        const row = await tx.probeAgent.upsert({
          where: { id },
          create: { id, createdAt, ...changes },
          update: changes
        });
        await this.syncOutage(tx, agent);
        return row;
      });
      EventDispatcher.dispatchEventsForAggregate(agent.id);
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

  public async saveIfUnchanged(
    agent: Agent,
    loadedUpdatedAt: Date
  ): Promise<Result<boolean>> {
    try {
      const {
        id,
        createdAt: _createdAt,
        ...changes
      } = AgentPrismaMapper.toPersistence(agent);
      const saved = await this.prisma.$transaction(async (tx) => {
        const { count } = await tx.probeAgent.updateMany({
          where: { id, updatedAt: loadedUpdatedAt },
          data: changes
        });
        if (count === 0) return false;
        await this.syncOutage(tx, agent);
        return true;
      });
      if (!saved) return Result.ok(false);
      EventDispatcher.markAggregateForDispatch(agent);
      EventDispatcher.dispatchEventsForAggregate(agent.id);
      return Result.ok(true);
    } catch (error) {
      return Result.fail(
        `Database error saving agent: ${this.message(error)}`
      );
    }
  }

  // Keeps the outage history in step with offlineSince (AGT-026): an agent
  // marked offline gets one open outage, and the save that clears
  // offlineSince, a reconnection or a revocation, closes it. Driven by state
  // rather than events so a lost event cannot leave an outage open.
  private async syncOutage(
    tx: Prisma.TransactionClient,
    agent: Agent
  ): Promise<void> {
    const agentId = agent.id.toString();
    const offlineSince = agent.offlineSince;
    if (offlineSince !== null) {
      const open = await tx.probeAgentOutage.findFirst({
        where: { agentId, endedAt: null },
        select: { id: true }
      });
      if (open === null) {
        await tx.probeAgentOutage.create({
          data: {
            agentId,
            silentSince:
              agent.lastSeenAt ?? agent.enrolledAt ?? offlineSince,
            offlineSince
          }
        });
      }
      return;
    }
    await tx.probeAgentOutage.updateMany({
      where: { agentId, endedAt: null },
      data: {
        endedAt: agent.updatedAt,
        endReason:
          agent.status === AgentStatus.REVOKED
            ? 'REVOKED'
            : 'RECONNECTED'
      }
    });
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
