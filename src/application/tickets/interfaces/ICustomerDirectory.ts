import { Result } from 'domain/shared/core';
import { TicketCustomerContactDTO } from '../dtos';

/**
 * Read-only window onto the customers context.
 *
 * The tickets context must not import another context's domain, but a work
 * order is useless without a name and a phone number to call. This port keeps
 * the read narrow — contact details only, never the Customer aggregate.
 */
export interface ICustomerDirectory {
  findContact(
    customerId: string
  ): Promise<Result<TicketCustomerContactDTO | null>>;
  exists(customerId: string): Promise<Result<boolean>>;
  /** The customer served by a device, via its contracted service. */
  findContactByDevice(
    deviceId: string
  ): Promise<Result<TicketCustomerContactDTO | null>>;
}
