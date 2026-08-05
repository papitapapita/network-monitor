import { Result } from 'domain/shared/core';
import {
  ITicketOpener,
  OpenTicketFromAlertRequestDTO,
  OpenTicketFromAlertUseCase
} from 'application/tickets';

/**
 * Lets the notifications context open a ticket without importing the tickets
 * application layer — the same one-adapter-knows-two-layers allowance ADR-0001
 * makes for alert publishing.
 */
export class TicketOpenerAdapter implements ITicketOpener {
  constructor(
    private readonly openTicketFromAlertUseCase: OpenTicketFromAlertUseCase
  ) {}

  async openFromAlert(
    request: OpenTicketFromAlertRequestDTO
  ): Promise<Result<void>> {
    const result =
      await this.openTicketFromAlertUseCase.execute(request);
    return result.isFailure ? Result.fail(result.error) : Result.ok();
  }
}
