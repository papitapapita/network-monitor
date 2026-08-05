import { TicketAddressDTO } from './TicketAddressDTO';

export interface UpdateTicketRequestDTO {
  id: string;
  title?: string;
  description?: string;
  category?: string;
  priority?: string;
  customerId?: string | null;
  deviceId?: string | null;
  address?: Partial<TicketAddressDTO> | null;
}
