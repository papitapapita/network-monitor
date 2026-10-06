import { PrismaClient } from 'generated/prisma/client';
import { Result } from 'domain/shared/core';
import { BillId } from 'domain/shared/ids';
import { IBillReminderLog } from 'domain/billing/repository';
import { isUniqueViolation } from '../../persistence/prisma-errors';

export class PrismaBillReminderLog implements IBillReminderLog {
  constructor(private readonly prisma: PrismaClient) {}

  async wasSentOn(
    billId: BillId,
    day: Date
  ): Promise<Result<boolean>> {
    try {
      const row = await this.prisma.billReminder.findUnique({
        where: {
          billId_sentOn: { billId: billId.toString(), sentOn: day }
        },
        select: { id: true }
      });
      return Result.ok(row !== null);
    } catch (error) {
      return Result.fail(
        `Database error reading bill reminders: ${(error as Error).message}`
      );
    }
  }

  async record(billId: BillId, day: Date): Promise<Result<void>> {
    try {
      await this.prisma.billReminder.create({
        data: { billId: billId.toString(), sentOn: day }
      });
      return Result.ok();
    } catch (error) {
      // Already recorded by a run that overlapped this one.
      if (isUniqueViolation(error)) return Result.ok();
      return Result.fail(
        `Database error recording a bill reminder: ${(error as Error).message}`
      );
    }
  }
}
