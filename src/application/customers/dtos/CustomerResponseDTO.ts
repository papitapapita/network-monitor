export interface CustomerResponseDTO {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  cedula: string | null;
  createdAt: string;
  updatedAt: string;
}
