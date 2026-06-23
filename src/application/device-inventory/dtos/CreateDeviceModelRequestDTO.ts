export interface CreateDeviceModelRequestDTO {
  vendorId: string;
  model: string;
  deviceType: string;
  isWireless?: boolean;
}
