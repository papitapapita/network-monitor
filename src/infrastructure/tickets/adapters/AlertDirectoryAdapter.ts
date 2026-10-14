import { PrismaClient } from 'generated/prisma/client';
import { Result } from 'domain/shared/core';
import {
  IAlertDirectory,
  TicketAlertSummaryDTO
} from 'application/tickets';

/**
 * Anti-corruption layer onto the notifications context. Returns the flat
 * summary a ticket is built from, not an Alert aggregate.
 */
export class AlertDirectoryAdapter implements IAlertDirectory {
  constructor(private readonly prisma: PrismaClient) {}

  public async findSummary(
    alertId: string
  ): Promise<Result<TicketAlertSummaryDTO | null>> {
    try {
      const raw = await this.prisma.alertEvent.findUnique({
        where: { id: alertId },
        select: {
          id: true,
          deviceId: true,
          type: true,
          severity: true,
          description: true
        }
      });

      return Result.ok<TicketAlertSummaryDTO | null>(raw);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<TicketAlertSummaryDTO | null>(
        `Database error finding alert summary: ${errorMessage}`
      );
    }
  }
}
