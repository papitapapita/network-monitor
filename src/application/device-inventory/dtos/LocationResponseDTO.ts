export interface LocationResponseDTO {
  id: string;
  name: string;
  type: string;
  municipality: string | null;
  neighborhood: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  altitude: number | null;
  createdAt: string;
  updatedAt: string;
}
