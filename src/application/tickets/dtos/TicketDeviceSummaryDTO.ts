export interface TicketDeviceSummaryDTO {
  id: string;
  name: string;
  ipAddress: string | null;
  macAddress: string | null;
  status: string;
  category: string | null;
  modelName: string | null;
  vendorName: string | null;
  locationName: string | null;
}
