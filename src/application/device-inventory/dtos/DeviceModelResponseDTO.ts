export interface DeviceModelResponseDTO {
  id: string;
  vendorId: string;
  vendorName: string;
  vendorSlug: string;
  model: string;
  deviceType: string;
  isWireless: boolean;
  poeSwitchOs: string | null;
  createdAt: string;
  updatedAt: string;
}
