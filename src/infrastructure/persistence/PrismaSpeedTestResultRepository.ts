import { PrismaClient } from 'generated/prisma/client';
import { Result } from 'domain/shared/core';
import { SpeedTestResult } from 'domain/device-monitoring/entities';
import {
  ISpeedTestResultRepository,
  SpeedTestPage,
  SpeedTestPageQuery
} from 'domain/device-monitoring/repository';
import { SpeedTestResultMapper } from '../mappers';

export class PrismaSpeedTestResultRepository
  implements ISpeedTestResultRepository
{
  constructor(private readonly prisma: PrismaClient) {}

  async save(
    result: SpeedTestResult
  ): Promise<Result<SpeedTestResult>> {
    try {
      const record = await this.prisma.speedTestResult.create({
        data: SpeedTestResultMapper.toPersistence(result)
      });
      return Result.ok(SpeedTestResultMapper.toDomain(record));
    } catch (error) {
      return Result.fail(
        `Database error saving speed test: ${(error as Error).message}`
      );
    }
  }

  async list(
    query: SpeedTestPageQuery
  ): Promise<Result<SpeedTestPage>> {
    try {
      const [records, total] = await this.prisma.$transaction([
        this.prisma.speedTestResult.findMany({
          // id breaks ties so paging never repeats or skips a row.
          orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
          take: query.limit,
          skip: query.offset
        }),
        this.prisma.speedTestResult.count()
      ]);
      return Result.ok({
        results: records.map(SpeedTestResultMapper.toDomain),
        total
      });
    } catch (error) {
      return Result.fail(
        `Database error listing speed tests: ${(error as Error).message}`
      );
    }
  }
}
