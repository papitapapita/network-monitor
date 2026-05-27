export interface CreateLocationRequestDTO {
  name: string;
  type: string;
  municipality?: string | null;
  neighborhood?: string | null;
  address?: string | null;
  // latitude and longitude must be provided together.
  latitude?: number | null;
  longitude?: number | null;
  altitude?: number;
}
