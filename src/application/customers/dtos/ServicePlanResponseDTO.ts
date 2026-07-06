export interface ServicePlanResponseDTO {
  id: string;
  name: string;
  downloadMbps: number;
  uploadMbps: number;
  monthlyPrice: number;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
