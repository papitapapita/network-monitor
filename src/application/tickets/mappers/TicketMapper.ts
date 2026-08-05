import { Ticket } from 'domain/tickets';
import {
  TicketResponseDTO,
  TicketDetailResponseDTO,
  TicketListResponseDTO,
  TicketAddressDTO,
  TicketCustomerContactDTO,
  TicketDeviceSummaryDTO,
  TechnicianSummaryDTO
} from '../dtos';

export class TicketMapper {
  public static toDTO(ticket: Ticket): TicketResponseDTO {
    const address = ticket.address;

    const addressDTO: TicketAddressDTO | null =
      address === null
        ? null
        : {
            street: address.street,
            municipality: address.municipality,
            neighborhood: address.neighborhood,
            reference: address.reference,
            latitude: address.latitude,
            longitude: address.longitude
          };

    return {
      id: ticket.id.toString(),
      code: ticket.code,
      status: ticket.status.value,
      priority: ticket.priority.value,
      category: ticket.category.value,
      title: ticket.title,
      description: ticket.description,
      customerId:
        ticket.customerId !== null
          ? ticket.customerId.toString()
          : null,
      deviceId:
        ticket.deviceId !== null ? ticket.deviceId.toString() : null,
      technicianId:
        ticket.technicianId !== null
          ? ticket.technicianId.toString()
          : null,
      address: addressDTO,
      scheduledFor: TicketMapper.toDateOnlyString(
        ticket.scheduledFor
      ),
      origin: ticket.origin.value,
      originAlertId: ticket.originAlertId,
      resolutionNotes: ticket.resolutionNotes,
      cancelReason: ticket.cancelReason,
      createdBy:
        ticket.createdBy !== null
          ? ticket.createdBy.toString()
          : null,
      assignedAt: TicketMapper.toIsoString(ticket.assignedAt),
      startedAt: TicketMapper.toIsoString(ticket.startedAt),
      resolvedAt: TicketMapper.toIsoString(ticket.resolvedAt),
      cancelledAt: TicketMapper.toIsoString(ticket.cancelledAt),
      createdAt: ticket.createdAt.toISOString(),
      updatedAt: ticket.updatedAt.toISOString()
    };
  }

  public static toDetailDTO(
    ticket: Ticket,
    customer: TicketCustomerContactDTO | null,
    device: TicketDeviceSummaryDTO | null,
    technician: TechnicianSummaryDTO | null
  ): TicketDetailResponseDTO {
    return {
      ...TicketMapper.toDTO(ticket),
      customer,
      device,
      technician
    };
  }

  public static toListDTO(
    tickets: Ticket[],
    total: number,
    limit: number = 20,
    offset: number = 0
  ): TicketListResponseDTO {
    return {
      tickets: tickets.map((t) => TicketMapper.toDTO(t)),
      total,
      hasMore: offset + tickets.length < total,
      limit,
      offset
    };
  }

  // Scheduling is by calendar day, so the wire format is a plain date with no
  // time or zone to misread.
  public static toDateOnlyString(date: Date | null): string | null {
    if (date === null) return null;
    return date.toISOString().slice(0, 10);
  }

  private static toIsoString(date: Date | null): string | null {
    return date === null ? null : date.toISOString();
  }
}
