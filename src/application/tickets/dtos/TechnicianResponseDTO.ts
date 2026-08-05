export interface TechnicianResponseDTO {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  userId: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
