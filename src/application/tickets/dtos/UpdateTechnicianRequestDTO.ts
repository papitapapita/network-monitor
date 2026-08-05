export interface UpdateTechnicianRequestDTO {
  id: string;
  fullName?: string;
  phone?: string;
  email?: string | null;
  userId?: string | null;
  isActive?: boolean;
}
