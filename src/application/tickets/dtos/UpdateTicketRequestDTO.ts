import { TicketAddressDTO } from './TicketAddressDTO';
import { TicketContactDTO } from './TicketContactDTO';

export interface UpdateTicketRequestDTO {
  id: string;
  title?: string;
  description?: string;
  category?: string;
  priority?: string;
  customerId?: string | null;
  deviceId?: string | null;
  address?: Partial<TicketAddressDTO> | null;
  contact?: Partial<TicketContactDTO> | null;
}
