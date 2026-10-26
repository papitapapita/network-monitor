export interface CreateCustomerRequestDTO {
  fullName: string;
  phone: string;
  email?: string | null;
  cedula?: string | null;
}
