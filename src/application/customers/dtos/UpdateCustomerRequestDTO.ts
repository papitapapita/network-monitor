export interface UpdateCustomerRequestDTO {
  id: string;
  fullName?: string;
  phone?: string;
  email?: string | null;
  cedula?: string | null;
}
