import { PrismaClient } from 'generated/prisma/client';
import { Result } from 'domain/shared/core';
import {
  ICustomerDirectory,
  TicketCustomerContactDTO
} from 'application/tickets';

/**
 * Anti-corruption layer onto the customers context. Reads contact columns
 * directly rather than hydrating the Customer aggregate — the tickets context
 * needs a name and a number, not a customer model.
 */
export class CustomerDirectoryAdapter implements ICustomerDirectory {
  constructor(private readonly prisma: PrismaClient) {}

  public async findContact(
    customerId: string
  ): Promise<Result<TicketCustomerContactDTO | null>> {
    try {
      const raw = await this.prisma.customer.findUnique({
        where: { id: customerId },
        select: { id: true, fullName: true, phone: true, email: true }
      });

      return Result.ok<TicketCustomerContactDTO | null>(raw ?? null);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<TicketCustomerContactDTO | null>(
        `Database error finding customer contact: ${errorMessage}`
      );
    }
  }

  public async exists(customerId: string): Promise<Result<boolean>> {
    try {
      const count = await this.prisma.customer.count({
        where: { id: customerId }
      });
      return Result.ok<boolean>(count > 0);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<boolean>(
        `Database error checking customer existence: ${errorMessage}`
      );
    }
  }

  // Device → ContractedService → Customer. There is no direct customer column
  // on a device, so this traversal is the only route.
  public async findContactByDevice(
    deviceId: string
  ): Promise<Result<TicketCustomerContactDTO | null>> {
    try {
      const service = await this.prisma.contractedService.findUnique({
        where: { deviceId },
        select: {
          customer: {
            select: {
              id: true,
              fullName: true,
              phone: true,
              email: true
            }
          }
        }
      });

      return Result.ok<TicketCustomerContactDTO | null>(
        service?.customer ?? null
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<TicketCustomerContactDTO | null>(
        `Database error finding customer by device: ${errorMessage}`
      );
    }
  }
}
