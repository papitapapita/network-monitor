import { ContactPhone } from '../value-objects';

export interface TicketContactProps {
  name: string;
  phone: ContactPhone | null;
}
