import {
  Ticket,
  TicketStatus,
  TicketPriority,
  TicketCategory,
  TicketOrigin,
  ServiceAddress
} from 'domain/tickets';
import {
  CustomerId,
  DeviceId,
  TechnicianId,
  TicketId,
  UserId
} from 'domain/shared/ids';
import { Result } from 'domain/shared/core';
import {
  TicketStatus as PrismaTicketStatus,
  TicketPriority as PrismaTicketPriority,
  TicketCategory as PrismaTicketCategory,
  TicketOrigin as PrismaTicketOrigin
} from 'generated/prisma/client';

type PrismaTicketRecord = {
  id: string;
  code: number;
  status: string;
  priority: string;
  category: string;
  title: string;
  description: string;
  customerId: string | null;
  deviceId: string | null;
  technicianId: string | null;
  addressStreet: string | null;
  addressMunicipality: string | null;
  addressNeighborhood: string | null;
  addressReference: string | null;
  latitude: number | { toNumber(): number } | null;
  longitude: number | { toNumber(): number } | null;
  scheduledFor: Date | null;
  origin: string;
  originAlertId: string | null;
  resolutionNotes: string | null;
  cancelReason: string | null;
  createdBy: string | null;
  assignedAt: Date | null;
  startedAt: Date | null;
  resolvedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

// `code` is omitted: the database sequence owns it.
type TicketPersistenceData = {
  id: string;
  status: PrismaTicketStatus;
  priority: PrismaTicketPriority;
  category: PrismaTicketCategory;
  title: string;
  description: string;
  customerId: string | null;
  deviceId: string | null;
  technicianId: string | null;
  addressStreet: string | null;
  addressMunicipality: string | null;
  addressNeighborhood: string | null;
  addressReference: string | null;
  latitude: number | null;
  longitude: number | null;
  scheduledFor: Date | null;
  origin: PrismaTicketOrigin;
  originAlertId: string | null;
  resolutionNotes: string | null;
  cancelReason: string | null;
  createdBy: string | null;
  assignedAt: Date | null;
  startedAt: Date | null;
  resolvedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export class TicketMapper {
  public static toDomain(raw: PrismaTicketRecord): Result<Ticket> {
    const idResult = TicketId.parse(raw.id);
    if (idResult.isFailure) {
      return Result.fail<Ticket>(
        `Invalid ticket ID: ${idResult.error}`
      );
    }

    let customerId: CustomerId | null = null;
    if (raw.customerId !== null) {
      const result = CustomerId.parse(raw.customerId);
      if (result.isFailure) {
        return Result.fail<Ticket>(
          `Invalid ticket customer ID: ${result.error}`
        );
      }
      customerId = result.value;
    }

    let deviceId: DeviceId | null = null;
    if (raw.deviceId !== null) {
      const result = DeviceId.parse(raw.deviceId);
      if (result.isFailure) {
        return Result.fail<Ticket>(
          `Invalid ticket device ID: ${result.error}`
        );
      }
      deviceId = result.value;
    }

    let technicianId: TechnicianId | null = null;
    if (raw.technicianId !== null) {
      const result = TechnicianId.parse(raw.technicianId);
      if (result.isFailure) {
        return Result.fail<Ticket>(
          `Invalid ticket technician ID: ${result.error}`
        );
      }
      technicianId = result.value;
    }

    let createdBy: UserId | null = null;
    if (raw.createdBy !== null) {
      const result = UserId.parse(raw.createdBy);
      if (result.isFailure) {
        return Result.fail<Ticket>(
          `Invalid ticket createdBy ID: ${result.error}`
        );
      }
      createdBy = result.value;
    }

    let address: ServiceAddress | null = null;
    if (
      raw.addressStreet !== null &&
      raw.addressMunicipality !== null &&
      raw.addressNeighborhood !== null
    ) {
      address = ServiceAddress.reconstitute({
        street: raw.addressStreet,
        municipality: raw.addressMunicipality,
        neighborhood: raw.addressNeighborhood,
        reference: raw.addressReference,
        latitude: TicketMapper.toNumber(raw.latitude),
        longitude: TicketMapper.toNumber(raw.longitude)
      });
    }

    const ticket = Ticket.reconstitute(idResult.value, {
      code: raw.code,
      status: TicketMapper.mapStatus(raw.status),
      priority: TicketMapper.mapPriority(raw.priority),
      category: TicketMapper.mapCategory(raw.category),
      title: raw.title,
      description: raw.description,
      customerId,
      deviceId,
      technicianId,
      address,
      scheduledFor: raw.scheduledFor,
      origin: TicketMapper.mapOrigin(raw.origin),
      originAlertId: raw.originAlertId,
      resolutionNotes: raw.resolutionNotes,
      cancelReason: raw.cancelReason,
      createdBy,
      assignedAt: raw.assignedAt,
      startedAt: raw.startedAt,
      resolvedAt: raw.resolvedAt,
      cancelledAt: raw.cancelledAt,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt
    });

    return Result.ok<Ticket>(ticket);
  }

  public static toPersistence(ticket: Ticket): TicketPersistenceData {
    const address = ticket.address;

    return {
      id: ticket.id.toString(),
      status: ticket.status.value as PrismaTicketStatus,
      priority: ticket.priority.value as PrismaTicketPriority,
      category: ticket.category.value as PrismaTicketCategory,
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
      addressStreet: address !== null ? address.street : null,
      addressMunicipality:
        address !== null ? address.municipality : null,
      addressNeighborhood:
        address !== null ? address.neighborhood : null,
      addressReference: address !== null ? address.reference : null,
      latitude: address !== null ? address.latitude : null,
      longitude: address !== null ? address.longitude : null,
      scheduledFor: ticket.scheduledFor,
      origin: ticket.origin.value as PrismaTicketOrigin,
      originAlertId: ticket.originAlertId,
      resolutionNotes: ticket.resolutionNotes,
      cancelReason: ticket.cancelReason,
      createdBy:
        ticket.createdBy !== null
          ? ticket.createdBy.toString()
          : null,
      assignedAt: ticket.assignedAt,
      startedAt: ticket.startedAt,
      resolvedAt: ticket.resolvedAt,
      cancelledAt: ticket.cancelledAt,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt
    };
  }

  // Prisma stores coordinates as Decimal. `Number()` alone would rely on the
  // Decimal's toString, so prefer its own toNumber() when present.
  private static toNumber(
    value: number | { toNumber(): number } | null
  ): number | null {
    if (value == null) return null;
    if (typeof value === 'number') return value;
    return value.toNumber();
  }

  // The four mappers below throw on an unrecognised value — the repository's
  // try/catch surfaces it as Result.fail. Deliberately strict: drift between
  // the Prisma enum and the domain must surface here, not silently coerce.
  private static mapStatus(value: string): TicketStatus {
    const result = TicketStatus.create(value);
    if (result.isFailure) {
      throw new Error(
        `Data integrity violation: unrecognised TicketStatus "${value}" in persistence store`
      );
    }
    return result.value;
  }

  private static mapPriority(value: string): TicketPriority {
    const result = TicketPriority.create(value);
    if (result.isFailure) {
      throw new Error(
        `Data integrity violation: unrecognised TicketPriority "${value}" in persistence store`
      );
    }
    return result.value;
  }

  private static mapCategory(value: string): TicketCategory {
    const result = TicketCategory.create(value);
    if (result.isFailure) {
      throw new Error(
        `Data integrity violation: unrecognised TicketCategory "${value}" in persistence store`
      );
    }
    return result.value;
  }

  private static mapOrigin(value: string): TicketOrigin {
    const result = TicketOrigin.create(value);
    if (result.isFailure) {
      throw new Error(
        `Data integrity violation: unrecognised TicketOrigin "${value}" in persistence store`
      );
    }
    return result.value;
  }
}
