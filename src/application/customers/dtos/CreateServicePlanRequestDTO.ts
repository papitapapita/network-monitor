export interface CreateServicePlanRequestDTO {
  name: string;
  downloadMbps: number;
  uploadMbps: number;
  monthlyPrice: number;
  description?: string | null;
  isActive?: boolean;
}
