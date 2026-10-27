import { PrismaClient } from 'generated/prisma/client';
import { Result } from 'domain/shared/core';
import { IInboxRecipientsQuery } from 'application/notifications/interfaces';

export class PrismaInboxRecipientsQuery
  implements IInboxRecipientsQuery
{
  constructor(private readonly prisma: PrismaClient) {}

  public async findActiveUserIds(
    adminsOnly: boolean
  ): Promise<Result<string[]>> {
    try {
      const users = await this.prisma.user.findMany({
        where: {
          disabledAt: null,
          ...(adminsOnly && { role: { in: ['ADMIN', 'VENDOR'] } })
        },
        select: { id: true }
      });
      return Result.ok(users.map((user) => user.id));
    } catch (error) {
      return Result.fail(
        `Database error loading inbox recipients: ${(error as Error).message}`
      );
    }
  }
}
