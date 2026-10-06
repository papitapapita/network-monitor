export interface CustomerResponseDTO {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  cedula: string | null;
  paymentDay: number;
  createdAt: string;
  updatedAt: string;
}
