// PATCH semantics: omitted fields are left unchanged; null clears the field.
// To clear coordinates, pass both latitude and longitude as null.
export interface UpdateLocationRequestDTO {
  id: string;
  name?: string;
  type?: string;
  municipality?: string | null;
  neighborhood?: string | null;
  address?: string | null;
  // latitude and longitude must be provided or cleared together.
  latitude?: number | null;
  longitude?: number | null;
  altitude?: number;
}
