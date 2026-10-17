export interface UpdateDeviceModelRequestDTO {
  id: string;
  vendorId?: string;
  model?: string;
  deviceType?: string;
  isWireless?: boolean;
  poeSwitchOs?: string | null;
}
