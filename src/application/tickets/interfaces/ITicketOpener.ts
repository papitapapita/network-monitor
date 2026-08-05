import { Result } from 'domain/shared/core';
import { OpenTicketFromAlertRequestDTO } from '../dtos';

/**
 * Inbound port for alert pipelines that want a ticket opened.
 *
 * The wireless context reaches this through a domain-event handler. The
 * device-down pipeline cannot: `Alert` raises no domain events, so
 * OpenAlertUseCase calls this port directly — the same "one module knows two
 * application layers" allowance ADR-0001 makes for alert publishing.
 */
export interface ITicketOpener {
  openFromAlert(
    request: OpenTicketFromAlertRequestDTO
  ): Promise<Result<void>>;
}
