import { PrismaClient } from 'generated/prisma/client';
import { Result } from 'domain/shared/core';
import { InboxNotificationId } from 'domain/shared/ids';
import { InboxNotification } from 'domain/notifications/entities';
import {
  IInboxNotificationRepository,
  InboxPage,
  InboxPageQuery
} from 'domain/notifications/repository';
import { InboxNotificationMapper } from '../mappers';

export class PrismaInboxNotificationRepository
  implements IInboxNotificationRepository
{
  constructor(private readonly prisma: PrismaClient) {}

  async findByIdForUser(
    id: InboxNotificationId,
    userId: string
  ): Promise<Result<InboxNotification | null>> {
    try {
      const record = await this.prisma.inboxNotification.findFirst({
        where: { id: id.toString(), userId }
      });
      return Result.ok(
        record ? InboxNotificationMapper.toDomain(record) : null
      );
    } catch (error) {
      return Result.fail(
        `Database error loading notification: ${(error as Error).message}`
      );
    }
  }

  async save(
    notification: InboxNotification
  ): Promise<Result<InboxNotification>> {
    try {
      const { id, ...data } =
        InboxNotificationMapper.toPersistence(notification);
      const fields = {
        ...data,
        severity: data.severity as 'WARNING' | 'CRITICAL'
      };
      const record = await this.prisma.inboxNotification.upsert({
        where: { id },
        create: { id, ...fields },
        update: { readAt: fields.readAt }
      });
      return Result.ok(InboxNotificationMapper.toDomain(record));
    } catch (error) {
      return Result.fail(
        `Database error saving notification: ${(error as Error).message}`
      );
    }
  }

  async addMany(
    notifications: InboxNotification[]
  ): Promise<Result<InboxNotification[]>> {
    if (notifications.length === 0) return Result.ok([]);
    try {
      const records =
        await this.prisma.inboxNotification.createManyAndReturn({
          data: notifications.map((notification) => {
            const data =
              InboxNotificationMapper.toPersistence(notification);
            return {
              ...data,
              severity: data.severity as 'WARNING' | 'CRITICAL'
            };
          }),
          skipDuplicates: true
        });
      return Result.ok(records.map(InboxNotificationMapper.toDomain));
    } catch (error) {
      return Result.fail(
        `Database error adding notifications: ${(error as Error).message}`
      );
    }
  }

  async listForUser(
    userId: string,
    query: InboxPageQuery
  ): Promise<Result<InboxPage>> {
    try {
      const where = {
        userId,
        ...(query.unreadOnly && { readAt: null })
      };
      const [records, total] = await this.prisma.$transaction([
        this.prisma.inboxNotification.findMany({
          where,
          // id breaks ties so paging never repeats or skips a row.
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: query.limit,
          skip: query.offset
        }),
        this.prisma.inboxNotification.count({ where })
      ]);
      return Result.ok({
        notifications: records.map(InboxNotificationMapper.toDomain),
        total
      });
    } catch (error) {
      return Result.fail(
        `Database error listing notifications: ${(error as Error).message}`
      );
    }
  }

  async countUnread(userId: string): Promise<Result<number>> {
    try {
      return Result.ok(
        await this.prisma.inboxNotification.count({
          where: { userId, readAt: null }
        })
      );
    } catch (error) {
      return Result.fail(
        `Database error counting notifications: ${(error as Error).message}`
      );
    }
  }

  async markAllRead(
    userId: string,
    at: Date
  ): Promise<Result<number>> {
    try {
      const { count } =
        await this.prisma.inboxNotification.updateMany({
          where: { userId, readAt: null },
          data: { readAt: at }
        });
      return Result.ok(count);
    } catch (error) {
      return Result.fail(
        `Database error marking notifications read: ${(error as Error).message}`
      );
    }
  }

  async hasOutageNotice(alertId: string): Promise<Result<boolean>> {
    try {
      const found = await this.prisma.inboxNotification.findFirst({
        where: { alertId, resolved: false },
        select: { id: true }
      });
      return Result.ok(found !== null);
    } catch (error) {
      return Result.fail(
        `Database error checking notifications: ${(error as Error).message}`
      );
    }
  }

  async deleteOlderThan(cutoff: Date): Promise<Result<number>> {
    try {
      const { count } =
        await this.prisma.inboxNotification.deleteMany({
          where: { createdAt: { lt: cutoff } }
        });
      return Result.ok(count);
    } catch (error) {
      return Result.fail(
        `Database error purging notifications: ${(error as Error).message}`
      );
    }
  }
}
