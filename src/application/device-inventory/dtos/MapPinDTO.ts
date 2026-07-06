export interface MapPinDeviceDTO {
  id: string;
  name: string;
  status: string;
  category: string | null;
  ipAddress: string | null;
  macAddress: string | null;
  monitoringEnabled: boolean;
}

export interface MapPinDTO {
  id: string;
  name: string;
  locationType: string;
  latitude: number;
  longitude: number;
  altitude: number | null;
  municipality: string | null;
  neighborhood: string | null;
  address: string | null;
  devices: MapPinDeviceDTO[];
}

export interface MapPinsResponseDTO {
  pins: MapPinDTO[];
  total: number;
}
