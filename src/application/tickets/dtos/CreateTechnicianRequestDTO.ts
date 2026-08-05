export interface CreateTechnicianRequestDTO {
  fullName: string;
  phone: string;
  email?: string | null;
  userId?: string | null;
  isActive?: boolean;
}
