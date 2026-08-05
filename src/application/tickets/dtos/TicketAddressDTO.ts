export interface TicketAddressDTO {
  street: string;
  municipality: string;
  neighborhood: string;
  reference: string | null;
  latitude: number | null;
  longitude: number | null;
}
