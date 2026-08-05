import { Result } from 'domain/shared/core';
import { TechnicianId, TicketId } from 'domain/shared/ids';
import { Ticket } from '../aggregates';
import { TicketFilter } from '../props';

export interface ITicketRepository {
  save(ticket: Ticket): Promise<Result<Ticket>>;
  findById(id: TicketId): Promise<Result<Ticket | null>>;
  findByCode(code: number): Promise<Result<Ticket | null>>;
  findAll(
    filter: TicketFilter,
    limit?: number,
    offset?: number
  ): Promise<Result<Ticket[]>>;
  countAll(filter: TicketFilter): Promise<Result<number>>;
  findForTechnicianOnDate(
    technicianId: TechnicianId,
    date: Date
  ): Promise<Result<Ticket[]>>;
  // Dedupe key for alert-opened tickets: an alert that is still breaching must
  // not spawn a second ticket on every poll.
  findActiveByOrigin(
    origin: string,
    alertId: string
  ): Promise<Result<Ticket | null>>;
  // Second dedupe level: a device with five breaching metrics is one visit,
  // not five jobs on the technician's day sheet.
  findActiveAlertTicketForDevice(
    deviceId: string
  ): Promise<Result<Ticket | null>>;
  countByTechnician(id: TechnicianId): Promise<Result<number>>;
  delete(id: TicketId): Promise<Result<void>>;
  exists(id: TicketId): Promise<Result<boolean>>;
}
