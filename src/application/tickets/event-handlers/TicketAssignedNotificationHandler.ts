import { IHandle } from 'domain/shared/interfaces';
import { TicketAssignedEvent } from 'domain/tickets/events';
import {
  ITicketRepository,
  ITechnicianRepository
} from 'domain/tickets';
import { ILogger } from 'application/shared/interfaces';
import { ITechnicianNotifier } from '../interfaces';
import { TicketMapper } from '../mappers';

/**
 * Tells the technician they have a new job. Reassignment notifies the new
 * technician only — the previous one finds out from their day sheet.
 */
export class TicketAssignedNotificationHandler
  implements IHandle<TicketAssignedEvent>
{
  constructor(
    private readonly ticketRepository: ITicketRepository,
    private readonly technicianRepository: ITechnicianRepository,
    private readonly notifier: ITechnicianNotifier,
    private readonly logger: ILogger
  ) {}

  async handle(event: TicketAssignedEvent): Promise<void> {
    try {
      const technicianResult =
        await this.technicianRepository.findById(
          event.newTechnicianId
        );
      if (technicianResult.isFailure) {
        this.logger.error(
          'TicketAssignedNotificationHandler: technician lookup failed',
          undefined,
          { error: technicianResult.error }
        );
        return;
      }
      if (technicianResult.value === null) {
        return;
      }

      const ticketResult = await this.ticketRepository.findById(
        event.aggregateId
      );
      if (ticketResult.isFailure || ticketResult.value === null) {
        this.logger.error(
          'TicketAssignedNotificationHandler: ticket lookup failed',
          undefined,
          {
            ticketId: event.aggregateId.toString(),
            error: ticketResult.isFailure ? ticketResult.error : null
          }
        );
        return;
      }

      const ticket = ticketResult.value;
      const technician = technicianResult.value;

      const result = await this.notifier.notifyAssignment({
        phone: technician.phone.toString(),
        technicianName: technician.fullName,
        ticketCode:
          ticket.code !== null
            ? `#${ticket.code}`
            : ticket.id.toString(),
        ticketTitle: ticket.title,
        scheduledFor: TicketMapper.toDateOnlyString(
          event.scheduledFor
        )
      });

      if (result.isFailure) {
        this.logger.error(
          'TicketAssignedNotificationHandler: notification failed',
          undefined,
          {
            ticketId: ticket.id.toString(),
            error: result.error
          }
        );
      }
    } catch (error) {
      this.logger.error(
        'TicketAssignedNotificationHandler: unexpected error',
        error instanceof Error ? error : new Error(String(error)),
        { ticketId: event.aggregateId.toString() }
      );
    }
  }
}
