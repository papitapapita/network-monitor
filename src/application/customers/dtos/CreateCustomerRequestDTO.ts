export interface CreateCustomerRequestDTO {
  fullName: string;
  phone: string;
  email?: string | null;
  cedula?: string | null;
  // 15 or 30; omitted means 30 (CUS-025).
  paymentDay?: number;
}
