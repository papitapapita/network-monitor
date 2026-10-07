import { PrismaClient } from 'generated/prisma/client';
import { EventDispatcher, Result } from 'domain/shared/core';
import { ConfigBackupId, DeviceId } from 'domain/shared/ids';
import {
  ConfigBackup,
  IConfigBackupRepository
} from 'domain/device-backups';
import { CredentialsEncryption } from '../../crypto';
import { ConfigBackupPrismaMapper } from '../mappers';

// Every read but findContent leaves the encrypted file out, so listing
// versions never moves or decrypts it.
const METADATA = {
  id: true,
  deviceId: true,
  format: true,
  contentHash: true,
  sizeBytes: true,
  trigger: true,
  takenAt: true,
  lastCheckedAt: true
} as const;

export class PrismaConfigBackupRepository
  implements IConfigBackupRepository
{
  constructor(private readonly prisma: PrismaClient) {}

  async add(
    backup: ConfigBackup,
    content: string
  ): Promise<Result<void>> {
    try {
      EventDispatcher.markAggregateForDispatch(backup);
      await this.prisma.configBackup.create({
        data: {
          ...ConfigBackupPrismaMapper.toPersistence(backup),
          encryptedContent: CredentialsEncryption.encrypt(content)
        }
      });
      EventDispatcher.dispatchEventsForAggregate(backup.id);
      return Result.ok();
    } catch (error) {
      return Result.fail(
        `Database error adding config backup: ${(error as Error).message}`
      );
    }
  }

  async save(backup: ConfigBackup): Promise<Result<void>> {
    try {
      await this.prisma.configBackup.update({
        where: { id: backup.id.toString() },
        data: { lastCheckedAt: backup.lastCheckedAt }
      });
      return Result.ok();
    } catch (error) {
      return Result.fail(
        `Database error saving config backup: ${(error as Error).message}`
      );
    }
  }

  async findById(
    id: ConfigBackupId
  ): Promise<Result<ConfigBackup | null>> {
    try {
      const raw = await this.prisma.configBackup.findUnique({
        where: { id: id.toString() },
        select: METADATA
      });
      return raw
        ? ConfigBackupPrismaMapper.toDomain(raw)
        : Result.ok(null);
    } catch (error) {
      return Result.fail(
        `Database error finding config backup: ${(error as Error).message}`
      );
    }
  }

  async findLatestByDevice(
    deviceId: DeviceId
  ): Promise<Result<ConfigBackup | null>> {
    try {
      const raw = await this.prisma.configBackup.findFirst({
        where: { deviceId: deviceId.toString() },
        orderBy: { takenAt: 'desc' },
        select: METADATA
      });
      return raw
        ? ConfigBackupPrismaMapper.toDomain(raw)
        : Result.ok(null);
    } catch (error) {
      return Result.fail(
        `Database error finding latest config backup: ${(error as Error).message}`
      );
    }
  }

  async listByDevice(
    deviceId: DeviceId
  ): Promise<Result<ConfigBackup[]>> {
    try {
      const rows = await this.prisma.configBackup.findMany({
        where: { deviceId: deviceId.toString() },
        orderBy: { takenAt: 'desc' },
        select: METADATA
      });
      const backups: ConfigBackup[] = [];
      for (const row of rows) {
        const mapped = ConfigBackupPrismaMapper.toDomain(row);
        if (mapped.isFailure) return Result.fail(mapped.error);
        backups.push(mapped.value);
      }
      return Result.ok(backups);
    } catch (error) {
      return Result.fail(
        `Database error listing config backups: ${(error as Error).message}`
      );
    }
  }

  async findContent(
    id: ConfigBackupId
  ): Promise<Result<string | null>> {
    try {
      const raw = await this.prisma.configBackup.findUnique({
        where: { id: id.toString() },
        select: { encryptedContent: true }
      });
      return Result.ok(
        raw
          ? CredentialsEncryption.decrypt(raw.encryptedContent)
          : null
      );
    } catch (error) {
      return Result.fail(
        `Error reading config backup content: ${(error as Error).message}`
      );
    }
  }

  async pruneOldVersions(
    deviceId: DeviceId,
    keep: number
  ): Promise<Result<number>> {
    try {
      const stale = await this.prisma.configBackup.findMany({
        where: { deviceId: deviceId.toString() },
        orderBy: { takenAt: 'desc' },
        skip: Math.max(keep, 1),
        select: { id: true }
      });
      if (stale.length === 0) return Result.ok(0);
      const removed = await this.prisma.configBackup.deleteMany({
        where: { id: { in: stale.map((s) => s.id) } }
      });
      return Result.ok(removed.count);
    } catch (error) {
      return Result.fail(
        `Database error pruning config backups: ${(error as Error).message}`
      );
    }
  }
}
