import { Result } from 'domain/shared/core';
import { TicketAlertSummaryDTO } from '../dtos';

/**
 * Read-only window onto the notifications context's alert store, for a person
 * turning a suggested alert into a ticket (TKT-115). Returns a flat summary,
 * never an Alert aggregate.
 */
export interface IAlertDirectory {
  findSummary(
    alertId: string
  ): Promise<Result<TicketAlertSummaryDTO | null>>;
}
