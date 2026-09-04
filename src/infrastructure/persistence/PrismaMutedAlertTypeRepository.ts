import { PrismaClient } from 'generated/prisma/client';
import { Result } from 'domain/shared/core';
import { MutedAlertType } from 'domain/notifications/entities';
import { IMutedAlertTypeRepository } from 'domain/notifications/repository';
import { MutedAlertTypeMapper } from '../mappers';

export class PrismaMutedAlertTypeRepository
  implements IMutedAlertTypeRepository
{
  constructor(private readonly prisma: PrismaClient) {}

  async listAll(): Promise<Result<MutedAlertType[]>> {
    try {
      const records = await this.prisma.mutedAlertType.findMany({
        orderBy: { metric: 'asc' }
      });
      return Result.ok(records.map(MutedAlertTypeMapper.toDomain));
    } catch (error) {
      return Result.fail(
        `Database error listing muted alert types: ${(error as Error).message}`
      );
    }
  }

  async isMuted(metric: string): Promise<Result<boolean>> {
    try {
      const record = await this.prisma.mutedAlertType.findUnique({
        where: { metric }
      });
      return Result.ok(record !== null);
    } catch (error) {
      return Result.fail(
        `Database error checking muted alert type: ${(error as Error).message}`
      );
    }
  }

  async replaceAll(
    metrics: string[]
  ): Promise<Result<MutedAlertType[]>> {
    try {
      const entities: MutedAlertType[] = [];
      const seen = new Set<string>();
      for (const metric of metrics) {
        const trimmed = metric?.trim();
        if (trimmed && seen.has(trimmed)) continue;
        if (trimmed) seen.add(trimmed);
        const result = MutedAlertType.create(metric);
        if (result.isFailure) {
          return Result.fail(result.error);
        }
        entities.push(result.value);
      }

      await this.prisma.$transaction([
        this.prisma.mutedAlertType.deleteMany({}),
        this.prisma.mutedAlertType.createMany({
          data: entities.map(MutedAlertTypeMapper.toPersistence)
        })
      ]);

      return Result.ok(entities);
    } catch (error) {
      return Result.fail(
        `Database error replacing muted alert types: ${(error as Error).message}`
      );
    }
  }
}
