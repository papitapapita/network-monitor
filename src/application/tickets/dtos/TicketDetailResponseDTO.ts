import { TicketResponseDTO } from './TicketResponseDTO';
import { TicketCustomerContactDTO } from './TicketCustomerContactDTO';
import { TicketDeviceSummaryDTO } from './TicketDeviceSummaryDTO';
import { TechnicianSummaryDTO } from './TechnicianSummaryDTO';

/**
 * A ticket with everything the technician needs before leaving: who to call,
 * what broke, and which device it happened on.
 */
export interface TicketDetailResponseDTO extends TicketResponseDTO {
  customer: TicketCustomerContactDTO | null;
  device: TicketDeviceSummaryDTO | null;
  technician: TechnicianSummaryDTO | null;
}
